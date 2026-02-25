import express from 'express';
import { Client, GatewayIntentBits, EmbedBuilder, AttachmentBuilder } from 'discord.js';
import { Player } from 'discord-player';
import { config } from 'dotenv';
import fetch from 'node-fetch';
config();

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('🎵 Discord Bot is running!');
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
    console.log(`🌐 Web server running on port ${PORT}`);
});

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
    ],
});

const player = new Player(client, {
    ytdlOptions: {
        quality: 'highestaudio',
        highWaterMark: 1 << 25,
    },
});

const prefix = '!';

// AI Configuration
const AI_API_URL = process.env.AI_API_URL || 'https://api.openai.com/v1';
const AI_API_KEY = process.env.OPENAI_API_KEY;
const STABILITY_API_KEY = process.env.STABILITY_API_KEY;

client.once('ready', () => {
    console.log(`🎵 Logged in as ${client.user.tag}`);
    client.user.setActivity({ type: 0, name: 'AI + Music | !help' });
});

player.on('error', (queue, error) => {
    console.error(`❌ Error in queue ${queue.guild.id}:`, error);
    queue.metadata.channel.send(`❌ Error: ${error.message}`);
});

player.on('connectionError', (queue, error) => {
    console.error(`❌ Connection error in ${queue.guild.id}:`, error);
    queue.metadata.channel.send(`❌ Connection error: ${error.message}`);
});

player.on('trackStart', (queue, track) => {
    const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('🎵 Now Playing')
        .setDescription(`**[${track.title}](${track.url})**`)
        .setThumbnail(track.thumbnail)
        .addFields(
            { name: 'Duration', value: track.duration, inline: true },
            { name: 'Requested by', value: track.requestedBy.tag, inline: true }
        )
        .setFooter({ text: `Volume: ${queue.node.volume}%` });
    queue.metadata.channel.send({ embeds: [embed] });
});

player.on('trackAdd', (queue, track) => {
    queue.metadata.channel.send(`✅ Added **${track.title}** to the queue!`);
});

player.on('queueEnd', (queue) => {
    queue.metadata.channel.send('📭 Queue finished! Leaving voice channel.');
});

player.on('disconnect', (queue) => {
    queue.metadata.channel.send('👋 Disconnected from voice channel.');
});

client.on('messageCreate', async (message) => {
    if (!message.content.startsWith(prefix) || message.author.bot) return;
    if (!message.guild) return; // DM commands not supported

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    const queue = player.nodes.create(message.guild, {
        metadata: { channel: message.channel, message: message },
        selfDeaf: true,
        volume: 80,
        leaveOnEnd: true,
        leaveOnEmpty: true,
        leaveOnEmptyCooldown: 60000,
    });

    try {
        // AI Commands
        if (command === 'imagine' || command === 'gen') {
            await handleImageGen(message, args);
            return;
        }
        
        if (command === 'vision' || command === 'see') {
            await handleImageRead(message);
            return;
        }
        
        if (command === 'video') {
            await handleVideoGen(message, args);
            return;
        }

        // Music Commands
        switch (command) {
            case 'play': case 'p':
                await handlePlay(message, args, queue); break;
            case 'skip': case 's':
                await handleSkip(message, queue); break;
            case 'stop': case 'leave':
                await handleStop(message, queue); break;
            case 'pause':
                await handlePause(message, queue); break;
            case 'resume': case 'r':
                await handleResume(message, queue); break;
            case 'queue': case 'q':
                await handleQueue(message, queue); break;
            case 'nowplaying': case 'np':
                await handleNowPlaying(message, queue); break;
            case 'volume': case 'vol':
                await handleVolume(message, args, queue); break;
            case 'shuffle':
                await handleShuffle(message, queue); break;
            case 'remove':
                await handleRemove(message, args, queue); break;
            case 'help':
                await handleHelp(message); break;
            case 'loop':
                await handleLoop(message, args, queue); break;
            case 'seek':
                await handleSeek(message, args, queue); break;
            case 'clear':
                await handleClear(message, queue); break;
            case 'jump':
                await handleJump(message, args, queue); break;
            case 'search':
                await handleSearch(message, args); break;
            default:
                return; // Don't send invalid command message for AI commands
        }
    } catch (error) {
        console.error('Command error:', error);
        message.channel.send(`❌ Error: ${error.message}`);
    }
});

// ==================== AI HANDLERS ====================

async function handleImageGen(message, args) {
    if (!AI_API_KEY && !STABILITY_API_KEY) {
        return message.channel.send('❌ AI image generation is not configured. Ask the bot owner to add API keys.');
    }

    const prompt = args.join(' ');
    if (!prompt) {
        return message.channel.send('❌ Please provide a prompt! Usage: `!imagine a beautiful sunset over mountains`');
    }

    const msg = await message.channel.send(`🎨 Generating image: **${prompt}**...`);

    try {
        // Try Stability AI first (free tier available)
        if (STABILITY_API_KEY) {
            const response = await fetch('https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${STABILITY_API_KEY}`,
                },
                body: JSON.stringify({
                    text_prompts: [{ text: prompt, weight: 1 }],
                    cfg_scale: 7,
                    height: 1024,
                    width: 1024,
                    steps: 30,
                    samples: 1,
                }),
            });

            if (response.ok) {
                const data = await response.json();
                const base64 = data.artifacts[0].base64;
                const buffer = Buffer.from(base64, 'base64');
                
                const attachment = new AttachmentBuilder(buffer, { name: 'generated.png' });
                const embed = new EmbedBuilder()
                    .setColor('#00ff00')
                    .setTitle('🎨 Generated Image')
                    .setDescription(`**${prompt}**`)
                    .setImage('attachment://generated.png');
                
                await message.channel.send({ embeds: [embed], files: [attachment] });
                await msg.delete();
                return;
            }
        }

        // Fallback to DALL-E if Stability fails
        if (AI_API_KEY) {
            const response = await fetch(`${AI_API_URL}/images/generations`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${AI_API_KEY}`,
                },
                body: JSON.stringify({
                    model: 'dall-e-3',
                    prompt: prompt,
                    size: '1024x1024',
                    quality: 'standard',
                    n: 1,
                }),
            });

            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error.message);
            }

            const imageUrl = data.data[0].url;
            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('🎨 Generated Image')
                .setDescription(`**${prompt}**`)
                .setImage(imageUrl)
                .setFooter({ text: 'Powered by DALL-E 3' });

            await message.channel.send({ embeds: [embed] });
            await msg.delete();
            return;
        }

        throw new Error('No AI provider available');
    } catch (error) {
        msg.delete();
        message.channel.send(`❌ Error generating image: ${error.message}`);
    }
}

async function handleImageRead(message) {
    // Check for attachments
    const attachment = message.attachments.first();
    
    if (!attachment) {
        // Check for URLs in message
        const urlMatch = message.content.match(/(https?:\/\/[^\s]+\.(?:png|jpg|jpeg|gif|webp))/i);
        if (!urlMatch) {
            return message.channel.send('❌ Please attach an image or provide an image URL! Usage: `!vision` (with image attached)');
        }
        return await analyzeImage(message, urlMatch[1]);
    }

    if (!attachment.url.match(/\.(?:png|jpg|jpeg|gif|webp|bmp)$/i)) {
        return message.channel.send('❌ Please provide a valid image file (PNG, JPG, GIF, WebP)');
    }

    await analyzeImage(message, attachment.url);
}

async function analyzeImage(message, imageUrl) {
    if (!AI_API_KEY) {
        return message.channel.send('❌ AI vision is not configured. Ask the bot owner to add OpenAI API key.');
    }

    const msg = await message.channel.send('🔍 Analyzing image...');

    try {
        const response = await fetch(`${AI_API_URL}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${AI_API_KEY}`,
            },
            body: JSON.stringify({
                model: 'gpt-4o',
                messages: [
                    {
                        role: 'user',
                        content: [
                            { type: 'text', text: 'Describe this image in detail. What do you see? Be specific about objects, people, colors, setting, and any text.' },
                            { type: 'image_url', image_url: { url: imageUrl } }
                        ]
                    }
                ],
                max_tokens: 500,
            }),
        });

        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error.message);
        }

        const description = data.choices[0].message.content;
        
        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('🔍 Image Analysis')
            .setDescription(description)
            .setFooter({ text: 'Powered by GPT-4o Vision' });

        await message.channel.send({ embeds: [embed] });
        await msg.delete();
    } catch (error) {
        msg.delete();
        message.channel.send(`❌ Error analyzing image: ${error.message}`);
    }
}

async function handleVideoGen(message, args) {
    // Note: Video generation APIs like Runway, Pika, Kling require special access
    // This is a placeholder - user would need to configure their own video API
    
    const prompt = args.join(' ');
    if (!prompt) {
        return message.channel.send('❌ Please provide a prompt! Usage: `!video a cat playing with a ball`');
    }

    // Check if user has a video API configured
    const VIDEO_API_KEY = process.env.VIDEO_API_KEY;
    const VIDEO_PROVIDER = process.env.VIDEO_PROVIDER; // 'runway', 'pika', 'kling'
    
    if (!VIDEO_API_KEY) {
        const embed = new EmbedBuilder()
            .setColor('#ff9900')
            .setTitle('🎬 Video Generation')
            .setDescription(`**${prompt}**`)
            .addFields(
                { name: 'Status', value: '⏳ Coming Soon', inline: true },
                { name: 'Note', value: 'Video generation requires additional API setup. Contact the bot owner.', inline: false }
            )
            .setFooter({ text: 'Providers coming: Runway, Pika, Kling, Sora' });
        
        await message.channel.send({ embeds: [embed] });
        return;
    }

    const msg = await message.channel.send(`🎬 Generating video: **${prompt}**... (This may take several minutes)`);

    try {
        let videoUrl;
        
        if (VIDEO_PROVIDER === 'runway') {
            const response = await fetch('https://api.runwayml.com/v1/generation/text_to_video', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${VIDEO_API_KEY}`,
                },
                body: JSON.stringify({ prompt: prompt }),
            });
            const data = await response.json();
            videoUrl = data.url;
        } else if (VIDEO_PROVIDER === 'pika') {
            const response = await fetch('https://api.pika.art/v1/generations', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${VIDEO_API_KEY}`,
                },
                body: JSON.stringify({ prompt: prompt }),
            });
            const data = await response.json();
            videoUrl = data.output;
        } else {
            throw new Error('Unknown video provider');
        }

        const embed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('🎬 Generated Video')
            .setDescription(`**${prompt}**`)
            .setURL(videoUrl)
            .setFooter({ text: `Powered by ${VIDEO_PROVIDER}` });

        await message.channel.send({ embeds: [embed] });
        await msg.delete();
    } catch (error) {
        msg.delete();
        message.channel.send(`❌ Error generating video: ${error.message}`);
    }
}

// ==================== MUSIC HANDLERS ====================

async function handlePlay(message, args, queue, searchResult = null) {
    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel) return message.channel.send('❌ You must be in a voice channel!');
    
    const permissions = voiceChannel.permissionsFor(message.client.user);
    if (!permissions.has('Connect') || !permissions.has('Speak')) {
        return message.channel.send('❌ I need permissions to join and speak!');
    }

    let query = args.join(' ');
    if (!query) return message.channel.send('❌ Provide a song name or URL!');

    try {
        message.channel.send(`🔍 Searching: **${query}**`);
        
        searchResult = await player.search(query, { requestedBy: message.author });
        if (!searchResult || !searchResult.tracks.length) {
            return message.channel.send('❌ No results found!');
        }

        if (!queue.connection) await queue.connect(voiceChannel);

        if (searchResult.playlist) {
            queue.addTrack(searchResult.tracks);
            message.channel.send(`✅ Added playlist **${searchResult.playlist.title}** (${searchResult.tracks.length} tracks)`);
        } else {
            queue.addTrack(searchResult.tracks[0]);
        }

        if (!queue.isPlaying()) await queue.node.play();
    } catch (error) {
        console.error('Play error:', error);
        message.channel.send(`❌ Error: ${error.message}`);
    }
}

async function handleSkip(message, queue) {
    if (!queue || !queue.isPlaying()) return message.channel.send('❌ Nothing playing!');
    queue.node.skip();
    message.channel.send('⏭️ Skipped');
}

async function handleStop(message, queue) {
    if (!queue || !queue.isPlaying()) return message.channel.send('❌ Nothing playing!');
    queue.delete();
    message.channel.send('🛑 Stopped!');
}

async function handlePause(message, queue) {
    if (!queue || !queue.isPlaying()) return message.channel.send('❌ Nothing playing!');
    if (queue.node.isPaused()) return message.channel.send('⏸️ Already paused!');
    queue.node.pause();
    message.channel.send('⏸️ Paused!');
}

async function handleResume(message, queue) {
    if (!queue || !queue.isPlaying()) return message.channel.send('❌ Nothing playing!');
    if (!queue.node.isPaused()) return message.channel.send('▶️ Already playing!');
    queue.node.resume();
    message.channel.send('▶️ Resumed!');
}

async function handleQueue(message, queue) {
    if (!queue || !queue.tracks.size) return message.channel.send('📭 Queue empty!');
    
    const tracks = queue.tracks.map((t, i) => `${i + 1}. **[${t.title}](${t.url})** - ${t.duration}`).join('\n');
    const current = queue.currentTrack ? `🎶 Now: **[${queue.currentTrack.title}](${queue.currentTrack.url})**` : '';
    
    const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('📋 Queue')
        .setDescription(current ? `${current}\n\n${tracks}` : tracks)
        .setFooter({ text: `${queue.tracks.size} tracks` });
    
    message.channel.send({ embeds: [embed] });
}

async function handleNowPlaying(message, queue) {
    if (!queue || !queue.isPlaying()) return message.channel.send('❌ Nothing playing!');
    
    const track = queue.currentTrack;
    const progress = queue.node.createProgressBar();
    
    const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('🎵 Now Playing')
        .setDescription(`**[${track.title}](${track.url})**`)
        .setThumbnail(track.thumbnail)
        .addFields(
            { name: 'Progress', value: progress.replace(/■/g, '▶️').replace(/░/g, '▬') },
            { name: 'Volume', value: `${queue.node.volume}%`, inline: true },
            { name: 'Loop', value: queue.repeatMode ? (queue.repeatMode === 1 ? '🔂' : '🔁') : '➡️', inline: true }
        );
    
    message.channel.send({ embeds: [embed] });
}

async function handleVolume(message, args, queue) {
    if (!queue || !queue.isPlaying()) return message.channel.send('❌ Nothing playing!');
    if (!args[0]) return message.channel.send(`🔊 Volume: **${queue.node.volume}%**`);
    
    const vol = parseInt(args[0]);
    if (isNaN(vol) || vol < 1 || vol > 100) return message.channel.send('❌ Volume must be 1-100!');
    
    queue.node.setVolume(vol);
    message.channel.send(`🔊 Volume: **${vol}%**`);
}

async function handleShuffle(message, queue) {
    if (!queue || !queue.tracks.size) return message.channel.send('❌ Queue empty!');
    queue.tracks.shuffle();
    message.channel.send('🔀 Shuffled!');
}

async function handleRemove(message, args, queue) {
    if (!queue || !queue.tracks.size) return message.channel.send('❌ Queue empty!');
    const idx = parseInt(args[0]) - 1;
    if (isNaN(idx) || idx < 0 || idx >= queue.tracks.size) return message.channel.send('❌ Invalid track number!');
    
    const track = queue.tracks.at(idx);
    queue.removeTrack(idx);
    message.channel.send(`🗑️ Removed **${track.title}**`);
}

async function handleLoop(message, args, queue) {
    if (!queue || !queue.isPlaying()) return message.channel.send('❌ Nothing playing!');
    const mode = args[0]?.toLowerCase();
    
    if (!mode || mode === 'track') { queue.setRepeatMode(1); message.channel.send('🔂 Track loop'); }
    else if (mode === 'queue') { queue.setRepeatMode(2); message.channel.send('🔁 Queue loop'); }
    else if (mode === 'off') { queue.setRepeatMode(0); message.channel.send('➡️ Loop off'); }
    else message.channel.send('❌ Use: `!loop track/queue/off`');
}

async function handleSeek(message, args, queue) {
    if (!queue || !queue.isPlaying()) return message.channel.send('❌ Nothing playing!');
    const time = args[0];
    if (!time) return message.channel.send('❌ Provide time (MM:SS)!');
    
    const seconds = parseTime(time);
    if (isNaN(seconds)) return message.channel.send('❌ Invalid format!');
    
    await queue.node.seek(seconds * 1000);
    message.channel.send(`⏩ Seeked to ${time}`);
}

async function handleClear(message, queue) {
    if (!queue || !queue.tracks.size) return message.channel.send('❌ Queue already empty!');
    queue.tracks.clear();
    message.channel.send('🗑️ Queue cleared!');
}

async function handleJump(message, args, queue) {
    if (!queue || !queue.tracks.size) return message.channel.send('❌ Queue empty!');
    const idx = parseInt(args[0]) - 1;
    if (isNaN(idx) || idx < 0 || idx >= queue.tracks.size) return message.channel.send('❌ Invalid track!');
    queue.node.skipTo(idx);
    message.channel.send(`⏭️ Jumped to track ${idx + 1}`);
}

async function handleSearch(message, args) {
    if (!args.length) return message.channel.send('❌ Provide a query!');
    const query = args.join(' ');
    
    const result = await player.search(query, { requestedBy: message.author });
    if (!result || !result.tracks.length) return message.channel.send('❌ No results!');
    
    const tracks = result.tracks.slice(0, 5);
    const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('🔍 Search Results')
        .setDescription(tracks.map((t, i) => `${i + 1}. **[${t.title}](${t.url})**`).join('\n'))
        .setFooter({ text: 'Reply with 1-5 to select' });
    
    const reply = await message.channel.send({ embeds: [embed] });
    const collected = await message.channel.awaitMessages({ 
        filter: m => m.author.id === message.author.id && /^[1-5]$/.test(m.content),
        max: 1, time: 30000 
    });
    
    if (!collected.size) return message.channel.send('❌ Timed out!');
    
    const idx = parseInt(collected.first().content) - 1;
    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel) return message.channel.send('❌ Join a voice channel!');
    
    const queue = player.nodes.create(message.guild, {
        metadata: { channel: message.channel },
        selfDeaf: true, volume: 80,
    });
    
    await queue.connect(voiceChannel);
    queue.addTrack(tracks[idx]);
    if (!queue.isPlaying()) await queue.node.play();
    
    message.channel.send(`✅ Playing **${tracks[idx].title}**`);
}

function parseTime(timeStr) {
    const p = timeStr.split(':').map(Number);
    if (p.length === 2) return p[0] * 60 + p[1];
    if (p.length === 3) return p[0] * 3600 + p[1] * 60 + p[2];
    return NaN;
}

async function handleHelp(message) {
    const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('🤖 Bot Commands')
        .setDescription('**🎨 AI Commands:**')
        .addFields(
            { name: '`!imagine <prompt>`', value: 'Generate an image (DALL-E 3 / Stable Diffusion)', inline: false },
            { name: '`!vision`', value: 'Analyze an image (GPT-4o Vision)', inline: false },
            { name: '`!video <prompt>`', value: 'Generate a video (Coming soon!)', inline: false },
            { name: '🎵 Music Commands:', value: '`!play`, `!skip`, `!pause`, `!resume`, `!queue`, `!np`, `!volume`, `!shuffle`, `!loop`, `!stop`', inline: false }
        )
        .setFooter({ text: 'Examples: !imagine a cat sitting on a rainbow' });
    
    message.channel.send({ embeds: [embed] });
}

client.login(process.env.DISCORD_TOKEN);

setInterval(() => console.log(`[Keep-alive] ${new Date().toISOString()}`), 60000);
