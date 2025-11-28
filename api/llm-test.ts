import { VercelRequest, VercelResponse } from '@vercel/node';
import { llm_api_test } from './utils/llm-client';
import type { LLMTestRequest, LLMTestResponse } from './utils/types';

export default async function handler(
    req: VercelRequest,
    res: VercelResponse
) {
    // CORS 헤더 설정
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
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    try {
        console.log('Received LLM test request body:', req.body);
        const { count } = req.body as LLMTestRequest;

        if (typeof count === 'undefined') {
            res.status(400).json({ error: 'Missing required field: count' });
            return;
        }

        const resultText = await llm_api_test(count);
        res.status(200).json({ resultText });

    } catch (error) {
        console.error('LLM API test error:', error);
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Internal server error',
        });
    }
}
