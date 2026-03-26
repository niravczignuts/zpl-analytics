import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { brief, brandMemory, pastPerformance, imageBase64, imageType } = await req.json();

    if (!brief?.trim()) {
      return NextResponse.json({ error: 'Brief is required' }, { status: 400 });
    }

    const teamName    = brandMemory?.teamName     || 'Super Smashers';
    const teamNick    = brandMemory?.teamNickname  || 'The Smashers';
    const tone        = Array.isArray(brandMemory?.tone) ? brandMemory.tone.join(', ') : (brandMemory?.tone || 'inspirational, aggressive');
    const players     = typeof brandMemory?.playerNames === 'string' ? brandMemory.playerNames : (Array.isArray(brandMemory?.playerNames) ? brandMemory.playerNames.join(', ') : 'the team');
    const season      = brandMemory?.seasonContext || '2025 cricket season';
    const handle      = brandMemory?.accountHandle || '@supersmasherscricket';

    const pastInsights = pastPerformance?.length > 0
      ? `Past top performers: ${JSON.stringify(pastPerformance.slice(0, 5))}`
      : 'No past data — optimize for maximum general reach.';

    // ── Step 1: Market Research (fast, no tools needed) ─────────────────────
    const marketRes = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `You are a cricket social media market expert. Based on current 2025 cricket and sports social media trends, provide:

1. 15 high-performing cricket hashtags (no # symbol) — mix of evergreen cricket tags + trending IPL/T20 tags + engagement tags
2. 3 key insights about what cricket content formats are performing best on Instagram right now

Return ONLY valid JSON, no markdown, no code fences:
{
  "trendingHashtags": ["cricket", ...15 tags],
  "keyInsights": "2-3 sentences about current best-performing cricket social media content formats and why they work"
}`,
      }],
    });

    let marketData = { trendingHashtags: ['cricket', 'ipl', 't20', 'cricketlovers', 'cricket2025'], keyInsights: 'Short-form video and behind-the-scenes content are dominating cricket social media in 2025.' };
    try {
      const mText = (marketRes.content[0] as any).text as string;
      const mJson = mText.match(/\{[\s\S]*\}/);
      if (mJson) marketData = JSON.parse(mJson[0]);
    } catch { /* use defaults */ }

    // ── Step 2: Generate 3 Campaign Concepts ─────────────────────────────────
    const userContent: any[] = [];

    if (imageBase64) {
      userContent.push({
        type: 'image',
        source: { type: 'base64', media_type: imageType || 'image/jpeg', data: imageBase64 },
      });
    }

    userContent.push({
      type: 'text',
      text: `You are a world-class cricket social media strategist for ${teamName} (${teamNick}).

Brand: ${teamName} | Tone: ${tone} | Players: ${players || 'team members'} | Season: ${season} | Handle: ${handle}
${pastInsights}

Market Intelligence:
- Top hashtags: ${marketData.trendingHashtags.slice(0, 8).join(', ')}
- Insights: ${marketData.keyInsights}

TODAY'S BRIEF: "${brief}"
${imageBase64 ? '\n⚡ IMAGE PROVIDED — anchor at least one concept around the uploaded image.' : ''}

Generate exactly 3 COMPLETELY DIFFERENT campaign concepts. Each must have a unique format, angle, and energy. No two can feel alike.

Return ONLY valid raw JSON (absolutely no markdown, no backticks, no code fences — start directly with {):
{
  "concepts": [
    {
      "id": "A",
      "title": "Punchy concept name (4-6 words)",
      "angle": "The unique creative hook in one compelling sentence",
      "format": "Cinematic Recap",
      "tone": "Dark & Dramatic",
      "caption": "Full Instagram caption with emojis. Start with a scroll-stopping hook. Use 2-3 line breaks. End with strong CTA. Min 200 characters.",
      "hashtags": ["cricket", "ipl", "t20cricket", "cricketfans", "supersmasherscricket", "smashers", ...30 total],
      "storyVersion": "Story caption under 100 chars + 2 emojis + CTA",
      "reelScript": "[0-5s: visual description] [5-12s: voiceover text] [12-15s: CTA text on screen]",
      "imagePrompt": "Detailed image generation prompt: lighting style, composition, mood, cricket elements, color palette, photographic style",
      "engagementPrediction": "High",
      "whyItWorks": "One sentence on the psychological hook driving shares"
    },
    {
      "id": "B",
      "title": "Different concept name",
      "angle": "Different angle",
      "format": "Player Spotlight",
      "tone": "Warm & Inspiring",
      "caption": "...",
      "hashtags": [...30 tags],
      "storyVersion": "...",
      "reelScript": "...",
      "imagePrompt": "...",
      "engagementPrediction": "Medium",
      "whyItWorks": "..."
    },
    {
      "id": "C",
      "title": "Third different concept",
      "angle": "Third angle",
      "format": "Fan Energy Hype",
      "tone": "Electric & Hype",
      "caption": "...",
      "hashtags": [...30 tags],
      "storyVersion": "...",
      "reelScript": "...",
      "imagePrompt": "...",
      "engagementPrediction": "High",
      "whyItWorks": "..."
    }
  ]
}`,
    });

    const conceptRes = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 6000,
      messages: [{ role: 'user', content: userContent }],
    });

    const conceptText = (conceptRes.content[0] as any).text as string;

    // Strip any markdown fences just in case
    const cleaned = conceptText.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[Campaign] No JSON in response. Raw:', conceptText.slice(0, 500));
      throw new Error('AI did not return valid JSON. Please try again.');
    }

    let data: any;
    try {
      data = JSON.parse(jsonMatch[0]);
    } catch (parseErr: any) {
      console.error('[Campaign] JSON parse error:', parseErr.message, '\nRaw:', jsonMatch[0].slice(0, 300));
      throw new Error('AI response could not be parsed. Please try again.');
    }

    if (!Array.isArray(data.concepts) || data.concepts.length === 0) {
      throw new Error('AI returned no concepts. Please try again.');
    }

    // ── Hardcoded cricket-specific FLUX prompts per concept format ───────────────
    // These guarantee cricket-themed output regardless of what Claude generates.
    const FORMAT_CRICKET_PROMPTS: Record<string, [string, string]> = {
      'Cinematic Recap': [
        'cricket batsman hitting powerful six shot over boundary, red ball in air, packed stadium crowd roaring, golden sunset stadium floodlights, dramatic motion blur on bat swing, photorealistic sports photography, wide angle cinematic lens, professional DSLR',
        'cricket team celebrating match victory on pitch, players jumping and embracing, wicket stumps in foreground, stadium crowd going wild, dramatic golden hour lighting, confetti, professional sports photojournalism',
      ],
      'Player Spotlight': [
        'cricket batsman portrait in full batting gear wearing helmet with visor, batting pads and gloves, holding cricket bat in aggressive stance at crease, blurred green cricket stadium background soft bokeh, dramatic rim lighting from floodlights, intense focused expression, editorial sports portrait, photorealistic',
        'cricket fast bowler mid-delivery stride action shot, bowling arm raised high about to release red cricket ball, white cricket uniform, dynamic explosive pose, cricket pitch and stumps background, professional sports action photography, shallow depth of field bokeh',
      ],
      'Fan Energy Hype': [
        'passionate cricket fans packed in stadium stands celebrating a boundary, crowd wearing colorful matching team jerseys arms raised cheering wildly, team flags and banners waving, electric vibrant atmosphere, wide angle stadium crowd shot, photorealistic sports event photography',
        'excited cricket fans faces painted in team colors, scarves and caps, joyful celebration in stadium seating, candid authentic sports fan photography, vibrant colors, real emotion',
      ],
      'Stats-Led': [
        'aerial drone shot directly above cricket pitch, perfectly maintained green outfield, white painted crease and popping crease lines, three wooden stumps and bails in center wicket, fielders in position, professional broadcast cricket overhead photography',
        'cricket match live scoreboard LED display at stadium showing runs wickets and overs, floodlit stadium background at night, television broadcast style cricket match graphic overlay, professional sports photography',
      ],
      'Behind the Scenes': [
        'cricket team huddle tactical discussion on ground, captain giving team talk, players in team training kit listening attentively in circle, green cricket ground background, candid authentic documentary sports photography, real team bonding moment',
        'cricket training session at practice nets, batsman facing delivery from coach, teammates watching in background, cricket equipment bags stumps visible, authentic cricket training ground atmosphere, documentary style photography',
      ],
      'Motivational': [
        'cricket captain lifting championship trophy high above head in triumph, teammates surrounding celebrating with arms raised, golden confetti shower from above, stadium floodlights background, epic victorious sports moment, inspirational warm golden color grade, photorealistic',
        'lone cricket player silhouette standing at the crease at sunset, cricket bat resting on shoulder, dramatic golden orange and purple sky horizon, stadium outline in background, cinematic inspirational sports photography, motivational mood',
      ],
    };

    const togetherKey = process.env.TOGETHER_API_KEY;
    const canUseAI = !!togetherKey;

    async function generateAIBackground(fluxPrompt: string): Promise<string | null> {
      if (!canUseAI) return null;
      try {
        const resp = await fetch('https://api.together.xyz/v1/images/generations', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${togetherKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'black-forest-labs/FLUX.1-schnell-Free',
            prompt: fluxPrompt,
            width: 1024,
            height: 1024,
            steps: 4,
            n: 1,
          }),
        });

        if (!resp.ok) {
          const errText = await resp.text();
          console.error('[Together.ai]', resp.status, errText.slice(0, 300));
          return null;
        }

        const d = await resp.json();
        // Free FLUX model returns b64_json, not url
        if (d.data?.[0]?.url) return d.data[0].url;
        if (d.data?.[0]?.b64_json) return `data:image/png;base64,${d.data[0].b64_json}`;
        console.error('[Together.ai] unexpected response shape:', JSON.stringify(d).slice(0, 200));
        return null;
      } catch (e) {
        console.error('[Together.ai error]', e);
        return null;
      }
    }

    // Fallback loremflickr with specific cricket photography keywords
    const FORMAT_FLICKR_KW: Record<string, [string, string]> = {
      'Cinematic Recap':   ['cricket,batting,stadium', 'cricket,victory,celebration'],
      'Player Spotlight':  ['cricket,batsman,sport',   'cricket,bowler,action'],
      'Fan Energy Hype':   ['cricket,fans,stadium',    'cricket,crowd,match'],
      'Stats-Led':         ['cricket,pitch,aerial',    'cricket,match,ground'],
      'Behind the Scenes': ['cricket,training,team',   'cricket,practice,nets'],
      'Motivational':      ['cricket,trophy,winner',   'cricket,sunset,sport'],
    };

    // Generate all 6 backgrounds in parallel (2 per concept)
    const bgPromises = data.concepts.map(async (concept: any) => {
      const [p1, p2] = FORMAT_CRICKET_PROMPTS[concept.format] || FORMAT_CRICKET_PROMPTS['Cinematic Recap'];
      const [kw1, kw2] = FORMAT_FLICKR_KW[concept.format] || ['cricket,sport', 'cricket,stadium'];
      const r1 = Math.floor(Math.random() * 9999);
      const r2 = Math.floor(Math.random() * 9999);

      const [bg1, bg2] = await Promise.all([
        generateAIBackground(p1),
        generateAIBackground(p2),
      ]);

      return {
        url1: bg1 || `https://loremflickr.com/1080/1080/${kw1}?random=${r1}`,
        url2: bg2 || `https://loremflickr.com/1080/1080/${kw2}?random=${r2}`,
        aiGenerated: !!(bg1 || bg2),
      };
    });

    const backgrounds = await Promise.all(bgPromises);
    data.concepts.forEach((concept: any, i: number) => {
      concept.imageUrls = [backgrounds[i].url1, backgrounds[i].url2];
      concept.aiImagesGenerated = backgrounds[i].aiGenerated;
    });

    return NextResponse.json({
      success: true,
      marketContext: {
        trendingHashtags: marketData.trendingHashtags,
        keyInsights: marketData.keyInsights,
      },
      concepts: data.concepts,
    });
  } catch (err: any) {
    console.error('[Campaign Generate Error]', err?.status, err?.message, err?.error);
    const msg = err?.error?.message || err?.message || 'Generation failed. Please try again.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
