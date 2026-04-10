# Mobile Speed Test

A modern, feature-rich mobile speed test application built with React Native and Expo.

## 🚀 Features

### Core Functionality
- **Real-time Speed Testing** - Download, upload, and ping measurements
- **Background Testing** - Automated tests at configurable intervals (30min to 24h)
- **Test History** - Complete history with filtering and statistics
- **Data Export** - Export results as CSV for analysis
- **Modern UI** - Clean, responsive design with dark/light theme support
- **Sound & Haptics** - Customizable sound effects and haptic feedback
- **Connection Quality** - Visual quality indicators based on test results

### Technical Features
- **NDT7 Compatible** - Uses Measurement Lab and Cloudflare servers
- **Cross-platform** - iOS and Android support
- **Theme Management** - Dark and light mode with system detection
- **Data Privacy** - All test results stored locally, privacy-first approach
- **Legal Compliance** - Privacy policy and terms of use integration
- **Responsive Design** - Optimized for various screen sizes
- **Performance Optimized** - Efficient animations and smooth interactions

## 📱 Screens

### SpeedHomeScreen
- Main speed testing interface with real-time gauge
- Start/Stop test controls with modern animations
- Background testing configuration with interval selection
- Share functionality for test results
- Connection quality indicators

### HistoryScreen
- Complete test history with calendar filtering
- Export to CSV functionality
- Clear history with confirmation
- Statistical insights and summaries

### SettingsScreen
- Theme selection (dark/light)
- Speed unit preferences (Mbps/Kbps/MB/s)
- History retention settings
- Sound and haptic controls
- Legal disclosure management

### GraphScreen
- Visual speed test history graphs
- Interactive data visualization
- Performance trend analysis

## 🛠️ Technical Stack

- **Framework**: React Native with Expo
- **Navigation**: React Navigation
- **Charts**: React Native Chart Kit
- **Storage**: AsyncStorage for local data
- **Styling**: StyleSheet with theme system
- **Testing**: Measurement Lab NDT7 protocol
- **Build**: Expo CLI and Metro bundler

## 📊 Data Sources

- **Speed Tests**: Measurement Lab (NDT7) and Cloudflare
- **Storage**: Local AsyncStorage (no cloud dependencies)
- **Privacy**: All data processed locally, user-controlled export

## 🎨 UI/UX Features

- **Modern Design**: Clean, minimalist interface
- **Dark/Light Themes**: System theme detection and manual override
- **Smooth Animations**: Gauge animations and transitions
- **Responsive Layout**: Optimized for mobile devices
- **Accessibility**: High contrast colors and clear typography
- **Haptic Feedback**: Customizable haptic responses
- **Sound Design**: Custom sound effects for interactions

## 🔧 Configuration

### Background Testing Intervals
- Every 30 minutes
- Every 1 hour
- Every 3 hours
- Every 6 hours
- Every 12 hours
- Every 24 hours

### Speed Units
- Mbps (Megabits per second)
- Kbps (Kilobits per second)
- MB/s (Megabytes per second)

### History Retention
- 30 days
- 90 days
- 1 year
- Keep until deleted

## 📱 Installation

```bash
# Clone the repository
git clone https://github.com/marcoschuster/mobile-speed-test.git

# Install dependencies
cd mobile-speed-test
npm install

# Start the development server
npm start
```

## 🔨 Development

```bash
# Install Expo CLI globally
npm install -g @expo/cli

# Start development server
expo start

# Build for production
expo build:android
expo build:ios
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔐 Privacy & Security

- **Local Storage**: All test results stored locally on device
- **No Tracking**: No analytics or tracking embedded
- **User Control**: Users control data export and deletion
- **Open Source**: Full transparency with publicly available code
- **Secure Testing**: Uses HTTPS connections to reputable services

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a Pull Request

## 📞 Support

For issues, questions, or feature requests, please visit the [GitHub Issues](https://github.com/marcoschuster/mobile-speed-test/issues) page.

---

**Built with ❤️ for accurate network speed testing**
