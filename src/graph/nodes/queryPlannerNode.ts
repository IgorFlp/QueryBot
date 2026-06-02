import { getSystemPrompt, getUserPromptTemplate, QueryAnalysisSchema } from '../../prompts/v1/queryAnalyzer.ts';
import { OpenRouterService } from '../../services/openrouterService.ts';
import type { GraphState } from '../graph.ts';

export function createQueryPlannerNode(llmClient: OpenRouterService) {

  return async (state: GraphState): Promise<Partial<GraphState>> => {

    try {
      const systemPrompt = getSystemPrompt();
      const userPrompt= getUserPromptTemplate(state.question!);

      const {data, error} = await llmClient.generateStructured(
        systemPrompt,
        userPrompt,
        QueryAnalysisSchema
      )

      if(error){
        console.log("Falha de analise de query, assumindo simples");
        return{
          ...state,
          error,
          isMultiStep: true,
        }
      }

      if(data?.requiresDecomposition && !!data.subQuestions.length){

        return{          
          isMultiStep: true,
          subQuestions: data.subQuestions,
          currentStep: 0,
          subQueries: [],
          subResults: []
        }

      }


      return {
        ...state,
      };
    } catch (error: any) {
      console.error('❌ Error analyzing query:', error.message);
      return {
        ...state,
        isMultiStep: false,
      };
    }
  }
}
