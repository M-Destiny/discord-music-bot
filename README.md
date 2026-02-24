# 🎵 Discord Music Bot

A feature-rich Discord music bot supporting YouTube, Spotify, Apple Music, SoundCloud, and more!

## ✨ Features

- **Multi-platform support**: YouTube, Spotify, Apple Music, SoundCloud, Bandcamp, Vimeo
- **Search functionality**: Interactive search with buttons to select tracks
- **Full playback controls**: Play, pause, resume, skip, stop, seek
- **Queue management**: View queue, shuffle, remove tracks, clear, jump to track
- **Loop modes**: Loop single track or entire queue
- **Volume control**: Adjust volume from 1-100%
- **Progress bar**: See current position in track
- **Rich embeds**: Beautiful Discord embeds with track info

## 🚀 Installation

### Prerequisites

- Node.js 18+
- Discord bot token

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/M-Destiny/discord-music-bot.git
   cd discord-music-bot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   ```

4. **Add your Discord bot token**
   
   Edit `.env` and add your token:
   ```
   DISCORD_TOKEN=your_actual_bot_token_here
   ```

5. **Invite your bot to your server**
   
   Use this link (replace `YOUR_CLIENT_ID` with your bot's client ID):
   ```
   https://discord.com/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=2169868817&scope=bot
   ```

6. **Start the bot**
   ```bash
   npm start
   ```

## 🎮 Commands

| Command | Description |
|---------|-------------|
| `!play <query/url>` | Play a song or add to queue |
| `!search <query>` | Search and select from results |
| `!skip` or `!s` | Skip current track |
| `!stop` or `!leave` | Stop and disconnect |
| `!pause` | Pause current track |
| `!resume` or `!r` | Resume paused track |
| `!queue` or `!q` | Show queue |
| `!nowplaying` or `!np` | Show current track with progress |
| `!volume <1-100>` | Set volume |
| `!shuffle` | Shuffle queue |
| `!remove <number>` | Remove track from queue |
| `!loop <track/queue/off>` | Toggle loop mode |
| `!seek <time>` | Seek to time (MM:SS) |
| `!jump <number>` | Jump to track in queue |
| `!clear` | Clear queue |
| `!help` | Show all commands |

## 📋 Supported Links

- 🎥 YouTube / YouTube Music
- 🎧 Spotify
- 🍎 Apple Music
- 🔊 SoundCloud
- 🎸 Bandcamp
- 📹 Vimeo

## 🛠️ Deployment

### Using PM2 (Production)
```bash
npm install -g pm2
pm2 start src/index.js --name music-bot
```

### Using Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
CMD ["npm", "start"]
```

### Using Render/Railway
Add the following environment variable:
- `DISCORD_TOKEN`: Your bot token

Set the start command to: `npm start`

## 📝 License

MIT License

## 🤝 Contributing

Contributions are welcome! Please open an issue or submit a PR.
