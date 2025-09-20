import { ExecutionPlan, PlanStep, ToolCallStep, WaitStep, ConditionalStep } from '../types/chat';
import { availableFunctions } from './functions';
import { GoogleApiService } from './googleApi';

export class FunctionOrchestrator {
  private plan: ExecutionPlan;
  private googleApi?: GoogleApiService;
  private userUuid?: string;
  private onProgress?: (plan: ExecutionPlan) => void;

  constructor(
    plan: ExecutionPlan, 
    googleApi?: GoogleApiService, 
    userUuid?: string,
    onProgress?: (plan: ExecutionPlan) => void
  ) {
    this.plan = plan;
    this.googleApi = googleApi;
    this.userUuid = userUuid;
    this.onProgress = onProgress;
  }

  async execute(): Promise<ExecutionPlan> {
    try {
      this.plan.status = 'executing';
      this.plan.currentStepIndex = 0;
      this.notifyProgress();

      await this.executeSteps(this.plan.steps);

      this.plan.status = 'completed';
      this.plan.currentStepIndex = undefined;
      this.notifyProgress();

      return this.plan;
    } catch (error) {
      console.error('Plan execution failed:', error);
      this.plan.status = 'failed';
      this.notifyProgress();
      throw error;
    }
  }

  private async executeSteps(steps: PlanStep[]): Promise<void> {
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      this.plan.currentStepIndex = i;
      
      try {
        step.status = 'executing';
        this.notifyProgress();

        await this.executeStep(step);

        step.status = 'completed';
        this.notifyProgress();
      } catch (error) {
        console.error(`Step ${step.id} failed:`, error);
        step.status = 'failed';
        step.error = error instanceof Error ? error.message : 'Unknown error';
        this.notifyProgress();
        
        // Stop execution on error (can be made configurable)
        throw error;
      }
    }
  }

  private async executeStep(step: PlanStep): Promise<void> {
    switch (step.type) {
      case 'tool_call':
        await this.executeToolCall(step as ToolCallStep);
        break;
      case 'wait':
        await this.executeWait(step as WaitStep);
        break;
      case 'conditional':
        await this.executeConditional(step as ConditionalStep);
        break;
      default:
        throw new Error(`Unknown step type: ${(step as any).type}`);
    }
  }

  private async executeToolCall(step: ToolCallStep): Promise<void> {
    const functionDef = availableFunctions[step.name];
    if (!functionDef) {
      throw new Error(`Function ${step.name} not found`);
    }

    try {
      const result = await functionDef.handler(step.arguments, this.googleApi, this.userUuid);
      step.result = result;
      
      // Store result in plan context for conditional evaluation
      this.plan.results[step.id] = result;
    } catch (error) {
      console.error(`Tool call ${step.name} failed:`, error);
      throw error;
    }
  }

  private async executeWait(step: WaitStep): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, step.duration_ms));
    step.result = { 
      rawResult: `Waited for ${step.duration_ms}ms`, 
      displayContent: `Paused for ${step.duration_ms / 1000} seconds.` 
    };
  }

  private async executeConditional(step: ConditionalStep): Promise<void> {
    const conditionResult = this.evaluateCondition(step.condition);
    
    if (conditionResult) {
      await this.executeSteps(step.then_steps);
    } else if (step.else_steps) {
      await this.executeSteps(step.else_steps);
    }
    
    step.result = { conditionResult, branchTaken: conditionResult ? 'then' : 'else' };
  }

  private evaluateCondition(condition: string): boolean {
    try {
      // Simple condition evaluation - can be enhanced
      // For now, support basic comparisons like "temperature > 30"
      // This is a simplified implementation - in production, you'd want a more robust parser
      
      // Replace step references with actual values
      let evaluableCondition = condition;
      
      // Look for patterns like "step_id.property" or "results.step_id.property"
      const stepRefPattern = /(?:results\.)?(\w+)\.(\w+)/g;
      evaluableCondition = evaluableCondition.replace(stepRefPattern, (match, stepId, property) => {
        const stepResult = this.plan.results[stepId];
        if (stepResult && stepResult.rawResult) {
          try {
            const parsed = JSON.parse(stepResult.rawResult);
            return parsed[property] || 'null';
          } catch {
            return 'null';
          }
        }
        return 'null';
      });

      // Simple evaluation using Function constructor (be careful in production)
      // This is a basic implementation - consider using a proper expression evaluator
      const func = new Function('return ' + evaluableCondition);
      return Boolean(func());
    } catch (error) {
      console.error('Condition evaluation failed:', error);
      return false;
    }
  }

  private notifyProgress(): void {
    if (this.onProgress) {
      this.onProgress({ ...this.plan });
    }
  }
}