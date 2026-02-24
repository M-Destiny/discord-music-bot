import { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { Player } from 'discord-player';
import { load } from '@discord-player/extractor';
import { config } from 'dotenv';
config();

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

const extractor = load();
player.use(extractor);

const prefix = '!';
const queues = new Map();

client.once('ready', () => {
    console.log(`🎵 Logged in as ${client.user.tag}`);
    console.log(`🎤 Music bot is ready to play!`);
    
    client.user.setActivity({
        type: 0,
        name: 'Music | !help',
    });
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

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    const queue = player.nodes.create(message.guild, {
        metadata: {
            channel: message.channel,
            message: message,
        },
        selfDeaf: true,
        volume: 80,
        leaveOnEnd: true,
        leaveOnEmpty: true,
        leaveOnEmptyCooldown: 60000,
        lagMonitor: 1000,
    });

    try {
        switch (command) {
            case 'play':
            case 'p':
                await handlePlay(message, args, queue);
                break;
            case 'skip':
            case 's':
                await handleSkip(message, queue);
                break;
            case 'stop':
            case 'leave':
                await handleStop(message, queue);
                break;
            case 'pause':
                await handlePause(message, queue);
                break;
            case 'resume':
            case 'r':
                await handleResume(message, queue);
                break;
            case 'queue':
            case 'q':
                await handleQueue(message, queue);
                break;
            case 'nowplaying':
            case 'np':
                await handleNowPlaying(message, queue);
                break;
            case 'volume':
            case 'vol':
                await handleVolume(message, args, queue);
                break;
            case 'shuffle':
                await handleShuffle(message, queue);
                break;
            case 'remove':
                await handleRemove(message, args, queue);
                break;
            case 'help':
                await handleHelp(message);
                break;
            case 'loop':
                await handleLoop(message, args, queue);
                break;
            case 'seek':
                await handleSeek(message, args, queue);
                break;
            case 'clear':
                await handleClear(message, queue);
                break;
            case 'jump':
                await handleJump(message, args, queue);
                break;
            case 'search':
                await handleSearch(message, args);
                break;
        }
    } catch (error) {
        console.error('Command error:', error);
        message.channel.send(`❌ Error: ${error.message}`);
    }
});

async function handlePlay(message, args, queue, searchResult = null) {
    const voiceChannel = message.member.voice.channel;
    
    if (!voiceChannel) {
        return message.channel.send('❌ You must be in a voice channel to play music!');
    }

    const permissions = voiceChannel.permissionsFor(message.client.user);
    if (!permissions.has('Connect') || !permissions.has('Speak')) {
        return message.channel.send('❌ I need permissions to join and speak in the voice channel!');
    }

    let tracks = [];
    let query = args.join(' ');

    if (searchResult) {
        tracks = searchResult.tracks;
    } else if (!query) {
        return message.channel.send('❌ Please provide a song name or URL!');
    }

    try {
        if (!searchResult) {
            message.channel.send(`🔍 Searching for: **${query}**`);
            
            searchResult = await player.search(query, {
                requestedBy: message.author,
                searchEngine: 'auto',
            });

            if (!searchResult || !searchResult.tracks.length) {
                return message.channel.send('❌ No results found!');
            }
            
            tracks = searchResult.tracks;
        }

        if (!queue.connection) {
            await queue.connect(voiceChannel);
        }

        if (searchResult.playlist) {
            queue.addTrack(tracks);
            message.channel.send(`✅ Added playlist **${searchResult.playlist.title}** (${tracks.length} tracks) to the queue!`);
            
            if (!queue.isPlaying()) {
                await queue.node.play();
            }
        } else {
            queue.addTrack(tracks[0]);
            
            if (!queue.isPlaying()) {
                await queue.node.play();
            }
        }

    } catch (error) {
        console.error('Play error:', error);
        message.channel.send(`❌ Error playing: ${error.message}`);
    }
}

async function handleSkip(message, queue) {
    if (!queue || !queue.isPlaying()) {
        return message.channel.send('❌ Nothing is playing!');
    }

    const currentTrack = queue.currentTrack;
    queue.node.skip();
    message.channel.send(`⏭️ Skipped **${currentTrack.title}**`);
}

async function handleStop(message, queue) {
    if (!queue || !queue.isPlaying()) {
        return message.channel.send('❌ Nothing is playing!');
    }

    queue.delete();
    message.channel.send('🛑 Stopped and cleared the queue!');
}

async function handlePause(message, queue) {
    if (!queue || !queue.isPlaying()) {
        return message.channel.send('❌ Nothing is playing!');
    }

    if (queue.node.isPaused()) {
        return message.channel.send('⏸️ Already paused!');
    }

    queue.node.pause();
    message.channel.send('⏸️ Paused!');
}

async function handleResume(message, queue) {
    if (!queue || !queue.isPlaying()) {
        return message.channel.send('❌ Nothing is playing!');
    }

    if (!queue.node.isPaused()) {
        return message.channel.send('▶️ Already playing!');
    }

    queue.node.resume();
    message.channel.send('▶️ Resumed!');
}

async function handleQueue(message, queue) {
    if (!queue || !queue.tracks.size) {
        return message.channel.send('📭 Queue is empty!');
    }

    const tracks = queue.tracks.map((track, i) => {
        return `${i + 1}. **[${track.title}](${track.url})** - ${track.duration}`;
    });

    const current = queue.currentTrack ? 
        `🎶 Now Playing: **[${queue.currentTrack.title}](${queue.currentTrack.url})** - ${queue.currentTrack.duration}` 
        : '';

    const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('📋 Music Queue')
        .setDescription(current ? `${current}\n\n${tracks.join('\n')}` : tracks.join('\n'))
        .setFooter({ text: `Total tracks: ${queue.tracks.size + (queue.currentTrack ? 1 : 0)}` });

    message.channel.send({ embeds: [embed] });
}

async function handleNowPlaying(message, queue) {
    if (!queue || !queue.isPlaying()) {
        return message.channel.send('❌ Nothing is playing!');
    }

    const track = queue.currentTrack;
    const progress = queue.node.createProgressBar();
    const timestamp = queue.node.getTimestamp();

    const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('🎵 Now Playing')
        .setDescription(`**[${track.title}](${track.url})**`)
        .setThumbnail(track.thumbnail)
        .addFields(
            { name: 'Duration', value: `${timestamp.progress === 'FINISHED' ? track.duration : timestamp.label} / ${track.duration}`, inline: true },
            { name: 'Volume', value: `${queue.node.volume}%`, inline: true },
            { name: 'Loop', value: queue.repeatMode ? (queue.repeatMode === 1 ? '🔂 Track' : '🔁 Queue') : '➡️ Off', inline: true }
        )
        .addFields(
            { name: 'Progress', value: progress.replace(/■/g, '▶️').replace(/░/g, '▬') }
        );

    message.channel.send({ embeds: [embed] });
}

async function handleVolume(message, args, queue) {
    if (!queue || !queue.isPlaying()) {
        return message.channel.send('❌ Nothing is playing!');
    }

    if (!args[0]) {
        return message.channel.send(`🔊 Current volume: **${queue.node.volume}%**`);
    }

    const volume = parseInt(args[0]);
    if (isNaN(volume) || volume < 1 || volume > 100) {
        return message.channel.send('❌ Volume must be between 1 and 100!');
    }

    queue.node.setVolume(volume);
    message.channel.send(`🔊 Volume set to **${volume}%**`);
}

async function handleShuffle(message, queue) {
    if (!queue || !queue.tracks.size) {
        return message.channel.send('❌ Queue is empty!');
    }

    queue.tracks.shuffle();
    message.channel.send('🔀 Queue shuffled!');
}

async function handleRemove(message, args, queue) {
    if (!queue || !queue.tracks.size) {
        return message.channel.send('❌ Queue is empty!');
    }

    const index = parseInt(args[0]) - 1;
    if (isNaN(index) || index < 0 || index >= queue.tracks.size) {
        return message.channel.send('❌ Invalid track number!');
    }

    const track = queue.tracks.at(index);
    queue.removeTrack(index);
    message.channel.send(`🗑️ Removed **${track.title}** from queue!`);
}

async function handleLoop(message, args, queue) {
    if (!queue || !queue.isPlaying()) {
        return message.channel.send('❌ Nothing is playing!');
    }

    const mode = args[0]?.toLowerCase();
    
    if (!mode || mode === 'track') {
        queue.setRepeatMode(1);
        message.channel.send('🔂 Loop enabled: **Track**');
    } else if (mode === 'queue') {
        queue.setRepeatMode(2);
        message.channel.send('🔁 Loop enabled: **Queue**');
    } else if (mode === 'off') {
        queue.setRepeatMode(0);
        message.channel.send('➡️ Loop disabled');
    } else {
        message.channel.send('❌ Use: `!loop track`, `!loop queue`, or `!loop off`');
    }
}

async function handleSeek(message, args, queue) {
    if (!queue || !queue.isPlaying()) {
        return message.channel.send('❌ Nothing is playing!');
    }

    const time = args[0];
    if (!time) {
        return message.channel.send('❌ Please provide a time to seek to (e.g., 1:30)!');
    }

    const seconds = parseTime(time);
    if (isNaN(seconds)) {
        return message.channel.send('❌ Invalid time format! Use MM:SS or HH:MM:SS');
    }

    await queue.node.seek(seconds * 1000);
    message.channel.send(`⏩ Seeked to **${time}**`);
}

async function handleClear(message, queue) {
    if (!queue || !queue.tracks.size) {
        return message.channel.send('❌ Queue is already empty!');
    }

    queue.tracks.clear();
    message.channel.send('🗑️ Queue cleared!');
}

async function handleJump(message, args, queue) {
    if (!queue || !queue.tracks.size) {
        return message.channel.send('❌ Queue is empty!');
    }

    const index = parseInt(args[0]) - 1;
    if (isNaN(index) || index < 0 || index >= queue.tracks.size) {
        return message.channel.send(`❌ Invalid track number! Queue has ${queue.tracks.size} tracks.`);
    }

    queue.node.skipTo(index);
    message.channel.send(`⏭️ Jumped to track **${index + 1}**`);
}

async function handleSearch(message, args) {
    if (!args.length) {
        return message.channel.send('❌ Please provide a search query!');
    }

    const query = args.join(' ');
    message.channel.send(`🔍 Searching for: **${query}**`);

    const result = await player.search(query, {
        requestedBy: message.author,
        searchEngine: 'auto',
    });

    if (!result || !result.tracks.length) {
        return message.channel.send('❌ No results found!');
    }

    const tracks = result.tracks.slice(0, 10);
    const options = tracks.map((track, i) => ({
        label: `${i + 1}. ${track.title}`,
        description: track.duration,
        value: String(i),
    }));

    const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('🔍 Search Results')
        .setDescription(tracks.map((t, i) => `${i + 1}. **[${t.title}](${t.url})** - ${t.duration}`).join('\n'))
        .setFooter({ text: 'Use the buttons to select a track' });

    const row = new ActionRowBuilder()
        .addComponents(
            tracks.slice(0, 5).map((track, i) => 
                new ButtonBuilder()
                    .setCustomId(`search_${i}`)
                    .setLabel(`${i + 1}`)
                    .setStyle(ButtonStyle.Primary)
            )
        );

    const reply = await message.channel.send({ embeds: [embed], components: [row] });

    const collector = reply.createMessageComponentCollector({
        time: 30000,
    });

    collector.on('collect', async (interaction) => {
        const index = parseInt(interaction.customId.split('_')[1]);
        const selectedTrack = tracks[index];

        const voiceChannel = message.member.voice.channel;
        if (!voiceChannel) {
            return interaction.reply('❌ You must be in a voice channel!');
        }

        const queue = player.nodes.create(message.guild, {
            metadata: {
                channel: message.channel,
                message: message,
            },
            selfDeaf: true,
            volume: 80,
        });

        await queue.connect(voiceChannel);
        queue.addTrack(selectedTrack);

        if (!queue.isPlaying()) {
            await queue.node.play();
        }

        await interaction.reply(`✅ Playing **${selectedTrack.title}**`);
        collector.stop();
    });
}

function parseTime(timeStr) {
    const parts = timeStr.split(':').map(Number);
    if (parts.length === 2) {
        return parts[0] * 60 + parts[1];
    } else if (parts.length === 3) {
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    return NaN;
}

async function handleHelp(message) {
    const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('🎵 Music Bot Commands')
        .setDescription('Here are all available commands:')
        .addFields(
            { name: '`!play <query/url>`', value: 'Play a song or add to queue (supports YouTube, Spotify, Apple Music, SoundCloud)', inline: false },
            { name: '`!search <query>`', value: 'Search and select from results', inline: false },
            { name: '`!skip` or `!s`', value: 'Skip current track', inline: false },
            { name: '`!stop` or `!leave`', value: 'Stop and disconnect', inline: false },
            { name: '`!pause`', value: 'Pause current track', inline: false },
            { name: '`!resume` or `!r`', value: 'Resume paused track', inline: false },
            { name: '`!queue` or `!q`', value: 'Show queue', inline: false },
            { name: '`!nowplaying` or `!np`', value: 'Show current track with progress', inline: false },
            { name: '`!volume <1-100>`', value: 'Set volume', inline: false },
            { name: '`!shuffle`', value: 'Shuffle queue', inline: false },
            { name: '`!remove <number>`', value: 'Remove track from queue', inline: false },
            { name: '`!loop <track/queue/off>`', value: 'Toggle loop mode', inline: false },
            { name: '`!seek <time>`', value: 'Seek to time (MM:SS)', inline: false },
            { name: '`!jump <number>`', value: 'Jump to track in queue', inline: false },
            { name: '`!clear`', value: 'Clear queue', inline: false },
        )
        .setFooter({ text: 'Supports: YouTube, Spotify, Apple Music, SoundCloud, Bandcamp, Vimeo' });

    message.channel.send({ embeds: [embed] });
}

client.login(process.env.DISCORD_TOKEN);
