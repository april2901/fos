import { VercelRequest, VercelResponse } from '@vercel/node';
import { analyzeMeetingContent } from './utils/llm-client';

export interface MeetingAnalysisRequest {
    transcript: string;        // STT로 인식된 회의 내용
    existingTopics?: string[]; // 기존 노드들의 주제 (중복 방지용)
}

export interface MeetingAnalysisResult {
    keyword: string;           // 핵심 키워드 (노드 라벨)
    category: '리서치' | '아이디어' | '개발' | '디자인' | '일반';
    summary: string;           // 간단한 요약
    isNewTopic: boolean;       // 새로운 주제인지 여부
    relatedTopicIndex?: number; // 관련된 기존 주제 인덱스 (있으면)
}

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
        const { transcript, existingTopics } = req.body as MeetingAnalysisRequest;

        if (!transcript || transcript.trim().length < 5) {
            return res.status(400).json({ 
                error: 'Transcript is required and must be at least 5 characters' 
            });
        }

        const result = await analyzeMeetingContent(transcript, existingTopics || []);
        return res.status(200).json(result);
    } catch (error) {
        console.error('Meeting analysis API error:', error);
        return res.status(500).json({
            error: error instanceof Error ? error.message : 'Unknown error',
            code: 'INTERNAL_SERVER_ERROR',
            timestamp: new Date().toISOString(),
        });
    }
}
