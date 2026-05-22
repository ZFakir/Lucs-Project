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
Note: Workers need to be validated by the admin before they are allowed access to the portal.
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

## Documentation
All the necessary documentation pertaining to this application and project need to be accessed with a valid WITS email account, any other email will permit you to see the document.
Documentation includes minutes of scrum meetings, daily stand-ups, overall project plan, and testing (plans and results).

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
### 3. Environment Variables Setup
Create a .env file in the root directory. You will need to configure your database and Google OAuth credentials.
```
# Server Configuration
PORT=8080

# Database Configuration 
DB_HOST=localhost
DB_USER=Fakir
DB_PASSWORD=BigPassword
DB_NAME=GroundWorksDB
DB_DIALECT=mysql
```

### 4. Database Initialisation
Initialise the database and run the migrations/seeders to populate the Municipalities, Wards, and Admin accounts.
```
npx sequelize-cli db:create
npx sequelize-cli db:migrate
npx sequelize-cli db:seed:all
```

### 5. Run the Application
Start the local development server.
```
node server.js (from Back-end) - recommended
/or/
npm run dev
```

## Testing
The project utilises a robust Jest testing suite to ensure frontend reliability across all modular components. The backend also has its own test suites, ensuring routes and models work as expected.

Run entire test suite for the frontend and backend respectively:
```
cd Front-end /or/ cd Back-end
npm test
```

## Project File Structure
Helper and miscellaneous files have been ommitted for a more simplified view.
Some files (like tests) have been grouped together for the same reason.
```
groundwork/
├── Back-end/                   # Node.js & Express API server
│   ├── config/                 # Database connection settings
│   ├── geolocation/            # Server-side mapping components
│   ├── models/                 # Sequelize ORM models (Resident, Report, Ward, etc.)
│   ├── routes/                 # Express API endpoints
│   ├── Tests/                  # Backend unit and integration tests
│   ├── seedGeography.js        # Database seeder for municipal boundary data
│   └── server.js               # Main backend entry point
│
├── Front-end/                  # Client-side web application
│   ├── Analytics/              # Data visualisation, heatmaps, and stats
│   │   └── data/               # GeoJSON files for map boundaries
│   ├── Homes/                  # Role-specific dashboards (Admin, Resident, Worker, Guest)
│   ├── Login/                  # Authentication and Google OAuth interfaces
│   ├── ModalUtilities/         # Reusable UI components (CivicModal, LocationPicker)
│   ├── NittyGritty/            # Core issue reporting logic and Ward views
│   └── Tests/                  # Frontend Jest test suites
│
├── package.json                # Root project configuration
└── README.md                   # Project documentation
```

## 🦆 Easter Eggs
Quack.

## Acknowledgements
* Topographic and Ward boundary data provided by South African municipal datasets.
* Municipal Demarcation Board (MDB)
* UI Avatars provided by ui-avatars.com.
* UI Icons provided by Google Material Symbols.
* Luc and Friends
