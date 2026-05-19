# 🏙️ GroundWork. Municipal Services

GroundWork is a comprehensive, end-to-end civic engagement and municipal management platform. Designed to bridge the communication gap between residents and local government, it empowers communities to report infrastructure issues while providing municipal workers and administrators with the tools they need to track, assign, and resolve them efficiently.

---

## Platform Features

### 1. Resident Portal (Public Civic Engagement)
* **Geospatial Issue Reporting:** An interactive map (powered by Leaflet and Turf.js) allows users to drop a pin on an issue. The system automatically calculates the exact Ward and Municipality using South African GeoJSON boundary data.
* **Smart Media Uploads:** Users can attach photographic evidence to reports. Features automatic Base64 encoding, live previews, and offline caching if the network drops during submission.
* **Dynamic Ward Tracking:** Residents can subscribe to specific wards to monitor local infrastructure health.
* **Informative Analytics:** Access to exportable data and infographics. Residents can view worker performance and an issue heat map, as well as other miscellaneous statistics.
* **Custom Notification Center:** Real-time polling for ward updates, featuring the ability to globally mute alerts or selectively mute specific wards.
* **Issue Feedback & "Bumping":** Residents can rate the quality of resolved issues via a 5-star modal and "bump" high-priority active issues to increase their frequency score and visibility.

### 2. Municipal Worker Portal (Field Operations)
* **Task Dashboard:** A dedicated interface for municipal field workers to view issues specifically assigned to them.
* **Status Tracking:** Workers can update the progress of issues from "Assigned" to "In Progress" and finally "Resolved."
* **Field Evidence:** Workers can upload post-repair images and add resolution notes directly from the field to close out tickets.

### 3. Administrator Portal (Command & Control)
* **Global Oversight:** Admins can view all incoming reports across all municipalities and wards.
* **Resource Allocation:** Intelligent assignment tools allow admins to dispatch specific municipal workers to specific issues based on workload and location.
* **Employee Management:** Tools to manage worker profiles, credentials, and access levels.

### 4. Analytics & Guest Dashboards (Data & Transparency)
* **Public Guest View:** A transparent, read-only dashboard allowing non-registered users to view the status of their local infrastructure.
* **Interactive Civic Maps:** Visual heatmaps and spatial distributions of reported issues across regions.
* **Performance Metrics:** Deep-dive analytics on municipal response times, issue aging (`AgeReport`), and resolution efficiency.
* **Dashboard Exporter:** Tools to generate and export statistical reports for municipal meetings and public records.

---

## Tech Stack & Architecture

### **Frontend (Client-Side)**
* **Core:** HTML5, Vanilla JavaScript (ES6 Modules)
* **Styling:** [Tailwind CSS](https://tailwindcss.com/) (via CDN) for utility-first, highly responsive design.
* **Mapping Engine:** [Leaflet.js](https://leafletjs.com/) for interactive cartography.
* **Geospatial Math:** [Turf.js](https://turfjs.org/) for offline Point-in-Polygon calculations and boundary detection.
* **Modular UI:** Custom-built, reusable Web Components (`CivicModal`, `LocationPicker`, Toast Notification System).

### **Backend (Server-Side)**
* **Environment:** [Node.js](https://nodejs.org/) and [Express.js](https://expressjs.com/)
* **Database Management:** [Sequelize ORM](https://sequelize.org/) for secure, relational queries.
* **Database:** PostgreSQL / MySQL (Relational architecture for complex mapping - e.g. Ward-to-Municipality-to-Resident).
* **Authentication:** Google Identity Services (OAuth 2.0) with custom Role-Based Access Control (RBAC) issuing distinct JWT sessions for Admins, Workers, and Residents.

### **Testing & QA**
* **Framework:** [Jest](https://jestjs.io/) with a JSDOM environment.
* **Strategy:** High-coverage unit and integration testing focused on DOM manipulation, asynchronous state changes, and API mocking.

---

## 🚀 Local Setup & Installation

Follow these instructions to get a copy of the project up and running on your local machine for development and testing.

### Prerequisites
* [Node.js](https://nodejs.org/) (v16.0 or higher recommended)
* [npm](https://www.npmjs.com/) (Node Package Manager)
* A local SQL Database server (PostgreSQL or MySQL)
* A Google Cloud Console account (for OAuth credentials)
* For ADMIN privileges: credentials provided in the documentation hand-in.

### 1. Clone the Repository
```
git clone [https://github.com/ZFakir/Lucs-Project.git]
```
### 2. Install Dependencies
```
npm install
```
### 3. 
TODO

## Testing
The project utilises a robust Jest testing suite to ensure frontend reliability across all modular components. The backend also has its own test suites, ensuring routes and models work as expected.

Run entire test suite for the frontend and backend respectively:
```
cd Front-end /or/ cd Back-end
npm test
```

## Project File Structure TODO
groundwork/
├── Analytics/              # Data vis, heatmaps, and GeoJSON boundaries (sa_wards.json)
├── Homes/                  # Role-specific dashboards
│   ├── AdminHome.js        # Command & Control routing
│   ├── Resident.js         # Citizen tracking & notifications
│   └── WorkerHome.js       # Field task management
├── Login/                  # Google OAuth, JWT handling, and Role-Based Routing
├── ModalUtilities/         # Shared UI: CivicModal, AlertModal, LocationPicker
├── NittyGritty/            # Core issue reporting logic and Ward-specific views
├── Tests/                  # Jest test suites for all frontend modules
├── server.js               # Express application entry point
└── package.json            # Project dependencies

## 🦆 Easter Eggs
Quack.

## Acknowledgements
* Topographic and Ward boundary data provided by South African municipal datasets.
* UI Avatars provided by ui-avatars.com.
* UI Icons provided by Google Material Symbols.
* Luc and Friends
