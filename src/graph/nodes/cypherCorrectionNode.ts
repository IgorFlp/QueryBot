import { OpenRouterService } from '../../services/openrouterService.ts';
import { Neo4jService } from '../../services/neo4jService.ts';
import type { GraphState } from '../graph.ts';
import { getSystemPrompt, getUserPromptTemplate, CypherCorrectionSchema } from '../../prompts/v1/cypherCorrection.ts';

export function createCypherCorrectionNode(
  llmClient: OpenRouterService,
  neo4jService: Neo4jService,
) {

  return async (state: GraphState): Promise<Partial<GraphState>> => {

    try {
      console.log('Attempting query correction with LLM...');
      
      const schema = await neo4jService.getSchema();
      const systemPrompt = getSystemPrompt(state.originalQuery || state.query || '');
      const userPrompt = getUserPromptTemplate(state.query!, state.validationError!, schema);

      const {data,error} = await llmClient.generateStructured(systemPrompt, userPrompt, CypherCorrectionSchema);

      if(error){
        console.error('Error during query correction:', error);
        return {          
          error: `Query correction failed: ${error}`,          
        };
      }

      console.log("Query correction result from LLM:", data?.correctedQuery);

      return {
        query:data?.correctedQuery,
        originalQuery: state.originalQuery || state.query,
        correctionAttempts: (state.correctionAttempts || 0) + 1,
        validationError: undefined,
        needsCorrection: false, // Assume correction is successful, validation will be done in the next node
      };
    } catch (error: any) {
      console.error('Error correcting query:', error.message);
      return {
        ...state,
        error: `Query correction failed: ${error.message}`,
      };
    }
  };
}
