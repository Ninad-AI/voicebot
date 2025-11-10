# Ninad AI - Voice Chatbot

A modern, interactive AI voice chatbot web application with stunning visual effects and real-time audio visualization.

## Features

- 🎤 **Voice Recording** - Capture audio input with real-time level monitoring
- 🎨 **WebGL Orb Visualization** - Interactive 3D orb with orange gradient effects
- ⚡ **Real-time Streaming** - AI response streaming capabilities
- 🌈 **Beautiful Gradients** - Smooth orange-to-black gradient background
- 📱 **Responsive Design** - Works seamlessly on desktop and mobile devices
- ✨ **Smooth Animations** - Powered by Framer Motion for fluid transitions

## Tech Stack

- **React 19.1.1** - Modern UI library
- **Vite 7.2.2** - Fast build tool and dev server
- **TailwindCSS 3.4.11** - Utility-first CSS framework
- **Framer Motion 11.5.4** - Animation library
- **OGL** - Lightweight WebGL library for 3D graphics
- **Lucide React** - Beautiful icon set

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/Ninad-AI/voicebot.git
cd voicebot
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser and navigate to `http://localhost:5173`

## Usage

1. **Start Recording** - Click the microphone button to start recording your voice
2. **Stop Recording** - Click again to stop and process the audio
3. **Start AI Stream** - Click the play button to initiate AI streaming
4. **Interact with Orb** - Hover over the orb for interactive visual effects

## Color Palette

- **Primary Orange**: `#FF7700`
- **Golden Orange**: `#E99200`
- **Deep Red-Orange**: `#B70000`
- **Pure Black**: `#000000`
- **White**: `#FFFFFF`

## Project Structure

```
voicebot/
├── src/
│   ├── components/
│   │   ├── Orb.jsx           # WebGL 3D orb visualization
│   │   ├── MicButton.jsx     # Voice recording button
│   │   ├── StartButton.jsx   # AI streaming button
│   │   └── TextFillLoader.jsx # Loading screen animation
│   ├── App.jsx               # Main application component
│   ├── index.css             # Global styles
│   └── main.jsx              # Application entry point
├── public/                   # Static assets
├── index.html               # HTML template
├── tailwind.config.js       # Tailwind configuration
├── vite.config.js          # Vite configuration
└── package.json            # Project dependencies
```

## Build for Production

```bash
npm run build
```

The optimized production build will be generated in the `dist` folder.

## License

© 2025 Ninad AI. Voice-powered conversations.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Contact

For questions or support, please open an issue on GitHub.
