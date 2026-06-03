import { Neo4jService } from '../../services/neo4jService.ts';
import type { GraphState } from '../graph.ts';
import config from '../../config.ts';

async function executeQuery(query:string, neo4jService: Neo4jService) {
  try{
    const isValid = await neo4jService.validateQuery(query);
    if (!isValid) {
      return{
        results: null,
        error: 'Query validation failed - invalid Cypher syntax',
        
      }      
    }
    const results = await neo4jService.query(query);
    if(!results.length){
      return{
        results: [],
        error: "No results found for the given query",
      }
    }
    console.log('Cypher query executed successfully:', results.length, 'records returned');

    return {
      results,
      error: null,
    };
    
  }catch(error:any){
    console.error('Error executing Cypher query:', error instanceof Error ? error.message : error);
    return {
      results: null,
      error: error.message ?? "Query execution failed - an unexpected error occurred",
    }
  }

}

function hasMoreSteps(state: GraphState): boolean {
  if (!state.isMultiStep || !state.subQuestions?.length || state.currentStep === undefined) {
    return false;
  }
  return state.currentStep < state.subQuestions.length;
}

function handleMultiStepProgression(state: GraphState, results: any[]){
  const updatedSubResults = [
    ...state.subResults ?? [],
    ...results
  ];

  const nextStep = (state.currentStep ?? 0) + 1;

  const multiStepState ={
    dbResults: results,
    subResults: updatedSubResults,
    currentStep: nextStep,
    needsCorrection: false,
  }

  const totalSteps = state.subQuestions?.length ?? 0;
  console.log(`Progressing multi-step query: Step ${nextStep} of ${totalSteps}`);

  if(hasMoreSteps({...state, ...multiStepState})){
    console.log('More steps remaining, proceeding to next sub-question');
    return multiStepState;
  }

  console.log('All steps completed for multi-step query');
  return multiStepState;
}

export function createCypherExecutorNode(neo4jService: Neo4jService) {

  return async (state: GraphState): Promise<Partial<GraphState>> => {
    try {

      const {results,error} = await executeQuery(state.query!, neo4jService);

      if (error && results === null) {
        console.log("Error in Cypher execution:", error);
        if(state.correctionAttempts! < config.maxCorrectionAttempts){
          console.log("Attempting to correct the query. Attempt number:", state.correctionAttempts! + 1);
          return {
            validationError: error,
            originalQuery: state.originalQuery || state.query,
            needsCorrection: true,
          }
        }
      }

      if(state.isMultiStep && state.subQuestions && state.currentStep !== undefined){
        const multiStepState = handleMultiStepProgression(state, results!);
        return {
          ...multiStepState
        };
      }
    
      if(!results?.length){
        return{
          dbResults: [],
          error: "No results found for the given query",
        }
      }

      return {     
        dbResults: results!,
        needsCorrection: false,        
      };
    } catch (error) {
      console.error('Error executing Cypher query:', error instanceof Error ? error.message : error);

      return {
        ...state,
        error: `Invalid Cypher query - ${error instanceof Error ? error.message : 'An unexpected error occurred'}`,
      };
    }

    }
  };
