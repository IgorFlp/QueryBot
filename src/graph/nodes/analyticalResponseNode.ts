import { AIMessage } from 'langchain';
import { OpenRouterService } from '../../services/openrouterService.ts';
import type { GraphState } from '../graph.ts';
import { AnalyticalResponseSchema, getErrorResponsePrompt, getMultiStepSynthesisPrompt, getNoResultsPrompt, getSystemPrompt, getUserPromptTemplate } from '../../prompts/v1/analyticalResponse.ts';

async function handleErrorReponse(state: GraphState, llmClient: OpenRouterService): Promise<Partial<GraphState>> {
  const systemPrompt = getSystemPrompt();
  const userPrompt = getErrorResponsePrompt(state.error || 'Unknown error', state.question);

  const {data,error} = await llmClient.generateStructured(systemPrompt, userPrompt, AnalyticalResponseSchema); 

  if(error){
    console.error('Error generating error response:', error);
    return {
      messages: [new AIMessage(`Sorry, an error occurred: ${error}`)],
      error,
      answer: `Sorry, an error occurred: ${error}`,
      followUpQuestions: [],
    };
  }
  return {
    messages: [new AIMessage(data?.answer!)],
    answer: data?.answer,
    followUpQuestions: data?.followUpQuestions,
  }
} 

async function handleSuccessResponse(state: GraphState, llmClient: OpenRouterService): Promise<Partial<GraphState>> {
  const systemPrompt = getSystemPrompt();
  let _userPrompt:string;
  if(
    Boolean(
      state.isMultiStep && 
      state.subResults?.length && 
      state.subQuestions?.length &&
      state.subQueries?.length
    )
  ){
    console.log('Generating multi-step synthesis prompt');
    const stepsData = state.subResults?.map((results, idx) => ({
      stepNumber: idx + 1,
      question: state.subQuestions![idx],
      query: state.subQueries![idx],
      results: JSON.stringify(results),
    }))
    
    _userPrompt = getMultiStepSynthesisPrompt(state.question || '', stepsData || []);


  }else{
    _userPrompt = getUserPromptTemplate(
      state.question || '', 
      state.query || '', 
      JSON.stringify(state.dbResults || []));
  }
  
  const {data,error} = await llmClient.generateStructured(systemPrompt, _userPrompt, AnalyticalResponseSchema);


  if(error){
    console.error('Error generating analytical response:', error);
    return {
      messages: [new AIMessage(`Sorry, an error generating your response ${error}`)],
      error,
      answer: `Sorry, an error occurred: ${error}`,
      followUpQuestions: [],
    };
  }

  return {
    messages: [new AIMessage(data?.answer!)],
    answer: data?.answer,
    followUpQuestions: data?.followUpQuestions,
  }

}

async function handleNoResultsResponse(state: GraphState, llmClient: OpenRouterService): Promise<Partial<GraphState>> {
  const systemPrompt = getSystemPrompt();
  const userPrompt = getNoResultsPrompt(
    state.question || '', 
    state.query || '');
  
  const {data,error} = await llmClient.generateStructured(systemPrompt, userPrompt, AnalyticalResponseSchema);
  if(error){
    console.error('Error generating no results response:', error);
    return {
      messages: [new AIMessage(`Sorry, an error generating your response ${error}`)],
      error,
      answer: `Sorry, an error occurred: ${error}`,
      followUpQuestions: [],
    };
  }

  return {
    messages: [new AIMessage(data?.answer!)],
    answer: data?.answer,
    followUpQuestions: data?.followUpQuestions,
  }
}
export function createAnalyticalResponseNode(llmClient: OpenRouterService) {
  return async (state: GraphState): Promise<Partial<GraphState>> => {
    try {
      if(state.error){
        return await handleErrorReponse(state,llmClient);
      }
      if(!state.dbResults || state.dbResults.length === 0){
        return await handleNoResultsResponse(state, llmClient);
      }
      return await handleSuccessResponse(state, llmClient);

    } catch (error: any) {
      console.error('Error generating analytical response:', error.message);
      return {
        ...state,
        error: `Response generation failed: ${error.message}`,
      };
    }
  };
}
