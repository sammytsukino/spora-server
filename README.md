# SPORA

> *"Not Revolutionary, But Evolutionary"*

**Text becomes generative art. Collaboration without destruction.**

⟡ ═════════════════════════════════════════ ⟡


## ✿ What is SPORA?

SPORA is a full-stack collaborative platform where written text transforms into unique generative botanical visualizations. Every word you write becomes a digital organism (a **flora**) shaped by its emotional tone, rhythmic structure, and linguistic properties.

### Core Concept

♦ **Write** → Your text is analyzed automatically (sentiment, morphology, rhythm)  
♦ **Watch it bloom** → Real-time generative visualization based on your words  
♦ **Collaborate** → Take "cuttings" from others' works, add your text, create new branches  
♦ **Preserve** → Original works remain untouched; lineage is fully traceable


⟡ ═════════════════════════════════════════ ⟡


## ✧ Key Features

### ❀ The Garden
Gallery of **blossoming works** (open for collaboration). Browse, explore, and take cuttings.

### ❦ The Greenhouse  
Gallery of **sealed works** (finalized creations, closed to further cuttings).

### ❖ The Laboratory
Your creative workspace. Write, preview in real-time, choose your license, and publish.

### ✣ Cuttings (Non-Destructive Forking)
▸ Take a cutting from any open work  
▸ Add your own text after " / "  
▸ Generate a new visual identity  
▸ Original stays intact, lineage tracked forever

### ✤ Genealogical Trees
Every flora maintains its complete family tree (from root (Gen 0) through all derivative generations).

⟡ ═════════════════════════════════════════ ⟡


## ♢ Architecture

### The Soil/Seed Model

**Soil** = Static visual template  
Assigned based on emotional analysis of the text (negative, neutral, positive). Defines color palette, growth pattern, and visual style.

**Seed** = Dynamic parameters  
Extracted from text morphology (character count, word density, rhythm, structure). These parameters drive the actual rendering.

This separation ensures:  
▹ Lightweight database storage (only parameters, not full renders)  
▹ Portability across visual environments  
▹ Regeneration of works without data loss

⟡ ═════════════════════════════════════════ ⟡


## ⚙ Tech Stack

This project is split into two repositories for better organization and deployment flexibility.

### Frontend Repository

**Technologies:**  
▸ React + TypeScript  
▸ Tailwind CSS for styling  
▸ p5.js / Three.js for generative visualizations

**Repository:** `spora-client`

### Backend Repository

**Technologies:**  
▸ Node.js + Express  
▸ MongoDB (NoSQL document database)  
▸ RESTful API architecture

**Text Analysis:**  
▸ Natural.js for morphological analysis  
▸ Sentiment.js for emotional detection  
▸ Custom algorithms for rhythm and structure extraction

**Repository:** `spora-server`

⟡ ═════════════════════════════════════════ ⟡


## ♡ User Roles

### ○ Guest
▹ Browse Garden and Greenhouse  
▹ View flora details and lineage trees  
▹ Try Laboratory in demo mode (no publishing)

### ❀ Cultivator
▹ Full access: create, publish, take cuttings  
▹ Manage own works (edit title, seal, hide, delete)  
▹ Download visualizations  
▹ Build collaborative genealogies

### ★ Admin
▹ Moderation tools (hide/delete content)  
▹ User management (suspend/delete accounts)  
▹ Review reports  
▹ Access activity logs

⟡ ═════════════════════════════════════════ ⟡


## ◈ Key Policies

### Immutable Text
Once published, text cannot be edited. This protects:  
▸ Historical integrity  
▸ Coherence with derivative works  
▸ Trust in the collaborative system

### Protected Collaboration
Works with cuttings **cannot be deleted** (only hidden). This ensures:  
▸ Derivative works remain functional  
▸ Co-authors' contributions are protected  
▸ Lineage integrity is preserved

### GDPR-Compliant Anonymization
Users can delete their account via soft delete:  
▹ All personal data eliminated (email, password, profile)  
▹ Works preserved as `[forgotten author]`  
▹ Cuttings continue functioning normally  
▹ Lineage remains traceable

⟡ ═════════════════════════════════════════ ⟡


## ◉ License System

Works are published under:  
▸ **CC-BY** (Attribution - Recommended)  

**License Inheritance:**  
Cuttings inherit license restrictions from parent work according to Creative Commons standard rules.

⟡ ═════════════════════════════════════════ ⟡


## ⊙ Project Goals

### Technical
▹ Build a functional full-stack application  
▹ Implement dual-phase text analysis (emotional + morphological)  
▹ Create parametric generative rendering system  
▹ Design a data architecture supporting forking and genealogy

### Artistic & Conceptual
▹ Explore direct relationship between textual and visual properties  
▹ Democratize generative art creation (no coding required)  
▹ Investigate shared authorship and organic collaboration models  
▹ Create inseparable bond between text and visual output

### Educational
▹ Master complete web development lifecycle  
▹ Gain advanced NLP experience in artistic context  
▹ Understand complexities of collaborative systems with traceability

⟡ ═════════════════════════════════════════ ⟡


## ◆ Getting Started

### Prerequisites
```bash
Node.js >= 16.x
MongoDB >= 5.x
npm or yarn
```

### Installation

**Frontend Repository:**
```bash
# Clone frontend repository
git clone https://github.com/yourusername/spora-frontend.git
cd spora-frontend

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your backend API URL

# Run development server
npm run dev
```

**Backend Repository:**
```bash
# Clone backend repository
git clone https://github.com/yourusername/spora-backend.git
cd spora-backend

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your MongoDB connection string

# Run development server
npm run dev
```

### Environment Variables

**Frontend (.env):**
```
VITE_API_URL=http://localhost:5000/api
```

**Backend (.env):**
```
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
PORT=5000
FRONTEND_URL=http://localhost:5173
```

⟡ ═════════════════════════════════════════ ⟡

## ◈ Project Structure

**Frontend Repository (spora-frontend):**
```
spora-frontend/
├── src/
│   ├── components/     # Reusable UI components
│   ├── pages/          # Main views (Garden, Laboratory, etc.)
│   ├── router/         # API communication
│   ├── services/       # Helper functions
│   └── styles/         # Global styles
├── public/             # Static assets
└── docs/               # Frontend documentation
```

**Backend Repository (spora-backend):**
```
spora-backend/
├── src/
│   ├── models/         # Mongoose schemas
│   ├── controllers/    # Business logic
│   ├── routes/         # Express routes
│   ├── services/       # Text analysis, generation
│   ├── middleware/     # Auth, validation, permissions
│   └── utils/          # Helper functions
├── tests/             # Test suites
└── docs/              # API documentation
```

⟡ ═════════════════════════════════════════ ⟡


## ◑ Contributing

This is an academic project. Contributions are not currently accepted, but feedback is welcome!

⟡ ═════════════════════════════════════════ ⟡


## ◍ License

This project is licensed under [LICENSE TYPE]. See LICENSE file for details.

Individual floras created on the platform are licensed by their respective authors.

⟡ ═════════════════════════════════════════ ⟡


## ◕ Author

**[Your Name]**  
SPORA ▸ CEI: Centros de Estudios de Innovación 
Academic Year: 2025-2026


⟡ ═════════════════════════════════════════ ⟡


## ♥ Acknowledgments

▹ Creative Commons for licensing framework  
▹ p5.js community for generative art tools  
▹ Open source NLP libraries (Natural.js, Sentiment.js)  
▹ Inspiration: GitHub (forking model), Wikipedia (collaborative content), Stack Overflow (attribution system)


⟡ ═════════════════════════════════════════ ⟡


## ◈ Contact

▸ **Email:** sammy.cabello.g@gmail.com
▸ **GitHub:** [@sammytsukino](https://github.com/sammytsukino)  
▸ **Project Demo:** [https://spora.com](https://spora.com)


⟡ ═════════════════════════════════════════ ⟡


**SPORA** ♡ Where every text has roots, and every collaboration branches into new possibilities.