import { aiService, AIProvider } from './aiService';

export interface VideoSummaryResult {
    title: string;
    markdown: string;
}

export const videoSummarySkillService = {
    /**
     * Extracts transcript and generates structured markdown summary for a YouTube video.
     */
    async generateSummary(
        videoUrl: string,
        provider: AIProvider,
        model: string,
        apiKey: string
    ): Promise<VideoSummaryResult> {
        if (!videoUrl) throw new Error("Video URL is required.");

        // 1. Fetch transcript from the local process_input API
        const processRes = await fetch('/api/process_input', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'url', content: videoUrl })
        });

        if (!processRes.ok) {
            const errText = await processRes.text();
            let errJson: any = {};
            try { errJson = JSON.parse(errText); } catch (e) {}
            throw new Error(errJson.error || errText || "Failed to extract video details.");
        }

        const resText = await processRes.text();
        let data: any = {};
        try {
            data = JSON.parse(resText);
        } catch (e) {
            throw new Error(`Invalid response format from server: ${resText.slice(0, 100)}`);
        }
        const extractedText = data.text;
        const title = data.metadata?.title || "YouTube Video Summary";

        // 2. Instruct AI to summarize the transcript in a structured markdown form
        const systemPrompt = `You are a Video Summarizer Agent.
Analyze the provided video transcript and generate a structured markdown note about the video.

You MUST strictly follow this markdown structure:
# [Video Title]

Source:
[Original URL]

Created:
[Timestamp (current time: ${new Date().toISOString()})]

Tags:
[Relevant tags starting with #, e.g. #AI #Learning]

## Executive Summary
[Write a concise summary of the video content here.]

## Key Insights
- [Insight 1]
- [Insight 2]
- [etc.]

## Important Concepts
[Describe the key theories, systems, or ideas explained in the video.]

## Actionable Takeaways
- [Practical action or step the viewer can take]
- [etc.]

## Related Topics
[Suggest 3-4 related topics for further search or notes.]`;

        const userPrompt = `Video Title: ${title}
Original URL: ${videoUrl}

Transcript text:
${extractedText}`;

        const summaryMarkdown = await aiService.generate(provider, model, apiKey, userPrompt, systemPrompt);

        return {
            title,
            markdown: summaryMarkdown
        };
    },

    /**
     * Saves the generated markdown summary to the Obsidian Vault.
     */
    async saveToVault(
        vaultPath: string,
        title: string,
        markdown: string,
        category: string = 'Video Summary'
    ): Promise<any> {
        if (!vaultPath) throw new Error("Obsidian Vault Path is not configured.");

        // Clean out frontmatter from the markdown body to avoid nesting frontmatter blocks
        let cleanBody = markdown;
        let noteSummary = '';
        let tags: string[] = ['#Learning'];

        // Try to strip title and frontmatter parts if the AI outputted them at the top
        const frontmatterMatch = markdown.match(/^---\r?\n([\s\S]+?)\r?\n---\r?\n([\s\S]*)$/);
        if (frontmatterMatch) {
            cleanBody = frontmatterMatch[2].trim();
        } else {
            // Remove initial title if AI repeated it
            cleanBody = markdown.replace(/^#\s+.+\r?\n/, '').trim();
        }

        // Extract summary and tags dynamically from the generated markdown for vault metadata
        const summaryMatch = markdown.match(/## Executive Summary\r?\n([\s\S]+?)(?:\r?\n##|$)/);
        if (summaryMatch) {
            noteSummary = summaryMatch[1].trim().slice(0, 150) + '...';
        }

        const tagsMatch = markdown.match(/Tags:\r?\n([^\r\n]+)/i);
        if (tagsMatch) {
            tags = tagsMatch[1].split(/\s+/).map(t => t.trim().replace(/^#/, '')).filter(Boolean);
        }

        // Call backend API to create note inside Obsidian
        const res = await fetch('/api/obsidian/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                vaultPath,
                title,
                content: cleanBody,
                category,
                keywords: tags,
                summary: noteSummary,
                date: new Date().toISOString()
            })
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || "Failed to save note to Obsidian Vault.");
        }

        return await res.json();
    }
};
