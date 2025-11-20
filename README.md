<div align="center">

# 🐜 AntHill

### Offsite Employee Management Simplified

**Organize your team. Empower your employees. Focus on what matters.**

[Website](https://www.anthillapp.com) • [Demo Video](https://www.anthillapp.com/about-us) • [Get Started](#getting-started)

</div>

---

## 📖 About AntHill

AntHill is an **offsite employee management application** built for small catering businesses that need to coordinate teams across multiple locations and events. We help companies become more organized and efficient while empowering employees to work their best without worrying about administrative tasks that take away from their daily work.

### The Problem We Solve

Managing offsite teams is chaotic. Between scheduling events, tracking hours, updating checklists, and keeping everyone informed, managers waste valuable time on coordination instead of focusing on delivering exceptional service. Employees struggle with unclear assignments, lost schedules, and manual hour tracking.

### Our Solution

AntHill centralizes everything your team needs in one intuitive mobile app:

- **Real-time scheduling** that everyone can access instantly
- **Automated time tracking** that eliminates manual timesheets
- **Dynamic checklists** that adapt to each event
- **Push notifications** that keep your team informed
- **Multi-company support** for employees working multiple jobs

---

## ✨ Key Features

### For Managers

- 📅 **Smart Scheduling** - Assign staff to events with visibility into availability and conflicts
- ⏱️ **Time & Attendance** - Automatic clock-in/out, pause tracking, and approval workflows
- ✅ **Custom Checklists** - Create and update event-specific task lists in real-time
- 📊 **Team Insights** - Track hours worked, event history, and team performance
- 🔔 **Instant Updates** - Push notifications ensure your team never misses important changes
- 🎨 **Customizable Experience** - Configure features and permissions per company needs

### For Employees

- 📱 **One-Tap Clock In/Out** - Start tracking time instantly when arriving at events
- 📅 **Personal Schedule** - View all your upcoming and past events in one place
- ✅ **Task Clarity** - Know exactly what needs to be done with live-updated checklists
- 💼 **Multi-Company Support** - Seamlessly switch between jobs without app switching
- 🔔 **Smart Notifications** - Get notified of new assignments and schedule changes
- 🕒 **Hour Tracking** - Review your worked hours and time entries anytime

---

## 🎯 Why AntHill?

### Built for Small Businesses

We understand small catering companies can't afford complex enterprise software. AntHill provides enterprise-level organization at a scale and price point that makes sense for teams of 5-50 employees.

### Mobile-First Design

Your team is always on the move. AntHill is built with React Native and Expo, ensuring a smooth native experience on both iOS and Android with offline-capable features.

### Flexible & Scalable

Start with basic scheduling and time tracking, then add features as you grow. Our modular design lets you enable or disable features per company, so you only pay for what you use.

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm
- Expo CLI (`npm install -g expo-cli`)
- iOS Simulator (Mac) or Android Emulator
- Firebase account with configured project

### Installation

```bash
# Clone the repository
git clone https://github.com/devinpadron/CateringApp.git
cd AntHill

# Install dependencies
npm install

# Start the development server
npm start

# Run on iOS
npm run ios

# Run on Android
npm run android
```

### Configuration

1. Add your Firebase configuration files:
    - iOS: `ios/AntHill/GoogleService-Info.plist`
    - Android: `android/app/google-services.json`

2. Set up environment variables in `app.config.js`

3. Configure Firebase services (Authentication, Firestore, Storage, Messaging)

---

## 🏗️ Tech Stack

- **Framework:** React Native with Expo SDK 52
- **Language:** TypeScript
- **Navigation:** React Navigation v6
- **Backend:** Firebase (Auth, Firestore, Storage, Crashlytics, Messaging)
- **State Management:** React Context API
- **UI Components:** Custom design system with theme support
- **Notifications:** Firebase Cloud Messaging

---

## 📚 Learn More

- **Website:** [anthillapp.com](https://www.anthillapp.com)
- **Demo Video:** Watch our full walkthrough at [anthillapp.com/about-us](https://www.anthillapp.com/about-us)
- **Documentation:** See [.github/copilot-instructions.md](.github/copilot-instructions.md) for development guidelines

---

## 👥 Team

**Owner:** Devin Padron

**Developers:** Alex Bakos & William Dougherty

---

## 📄 License

This project is proprietary software. All rights reserved.

---

<div align="center">

**Made with ❤️ for the catering industry**

[Visit anthillapp.com](https://www.anthillapp.com) to learn more and see AntHill in action

</div>
