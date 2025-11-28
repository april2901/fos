import { VercelRequest, VercelResponse } from '@vercel/node';
import { extractKeywordsFromScript } from './utils/llm-client';
import { KeywordExtractionRequest, ApiErrorResponse } from './utils/types';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS handling
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { script } = req.body as KeywordExtractionRequest;

        if (!script) {
            return res.status(400).json({ error: 'Script is required' });
        }

        const keywords = await extractKeywordsFromScript(script);
        return res.status(200).json({ keywords });
    } catch (error) {
        console.error('Keyword extraction API error:', error);
        const errorResponse: ApiErrorResponse = {
            error: error instanceof Error ? error.message : 'Unknown error',
            code: 'INTERNAL_SERVER_ERROR',
            timestamp: new Date().toISOString(),
        };
        return res.status(500).json(errorResponse);
    }
}
