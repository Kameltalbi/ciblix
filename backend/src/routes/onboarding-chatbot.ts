import { Router } from 'express';
import { z } from 'zod';
import { optionalAuth } from '../middleware/auth.js';

export const onboardingChatbotRoutes = Router();
onboardingChatbotRoutes.use(optionalAuth);

const querySchema = z.object({
  message: z.string().min(1).max(1000),
  language: z.enum(['fr', 'en', 'ar']).optional().default('fr'),
});

async function callOpenAIForOnboarding(prompt: string, language: 'fr' | 'en' | 'ar') {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API key not configured');
  }

  const languageInstruction = {
    fr: 'Réponds en français simple, clair et concret.',
    en: 'Answer in simple, clear, practical English.',
    ar: 'أجب بلغة عربية بسيطة وواضحة وعملية.',
  }[language];

  const systemPrompt = [
    'You are an onboarding chatbot for CIBLIX CRM.',
    'You are independent from the in-app AI assistant.',
    'Your job is to explain product onboarding and app usage only.',
    'Focus on: prospects, conversion, clients, affaires pipeline, activities, calendar, support tickets, and first-week setup.',
    'Do not hallucinate unavailable features. If unsure, provide generic safe guidance.',
    'Keep responses concise and actionable (3-8 bullets max when suitable).',
    languageInstruction,
  ].join(' ');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.3,
      max_tokens: 500,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI onboarding error: ${err}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || 'Je n’ai pas pu générer une réponse pour le moment.';
}

onboardingChatbotRoutes.post('/query', async (req, res, next) => {
  try {
    const { message, language } = querySchema.parse(req.body ?? {});
    const answer = await callOpenAIForOnboarding(message, language);
    res.json({
      type: 'onboarding_openai',
      answer,
    });
  } catch (error) {
    next(error);
  }
});
