import { useMutation } from '@tanstack/react-query';
import { tokenize, type TokenizeRequest, type TokenizeResponse } from '@/api/tokenize';

/**
 * Custom hook for tokenizing text using React Query mutation
 * 
 * @returns mutation object with mutate function and state (isLoading, error, data)
 * 
 * @example
 * const tokenizeMutation = useTokenizer();
 * 
 * // Tokenize words
 * tokenizeMutation.mutate({ text: 'your text here', type: 'word' });
 * 
 * // Tokenize sentences
 * tokenizeMutation.mutate({ text: 'your text here', type: 'sentence' });
 */
export const useTokenizer = () => {
  return useMutation<TokenizeResponse, Error, TokenizeRequest>({
    mutationFn: tokenize,
  });
};

