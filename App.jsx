<!DOCTYPE html>

<html class="light" lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>Family Tree - The Living Archive</title>
<!-- Fonts -->
<link href="https://fonts.googleapis.com" rel="preconnect"/>
<link crossorigin="" href="https://fonts.gstatic.com" rel="preconnect"/>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&amp;family=Inter:wght@400;500;600&amp;display=swap" rel="stylesheet"/>
<!-- Icons -->
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<!-- Tailwind CSS -->
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<script id="tailwind-config">
        tailwind.config = {
            darkMode: "class",
            theme: {
                extend: {
                    colors: {
                        "on-tertiary": "#ffffff",
                        "on-tertiary-fixed": "#111c2d",
                        "surface-container": "#eceef0",
                        "on-secondary-fixed-variant": "#3a485b",
                        "on-tertiary-container": "#fefcff",
                        "tertiary": "#515c71",
                        "outline-variant": "#c2c6d6",
                        "surface-container-high": "#e6e8ea",
                        "inverse-surface": "#2d3133",
                        "primary-fixed": "#dbe1ff",
                        "on-primary": "#ffffff",
                        "secondary-fixed-dim": "#b9c7df",
                        "secondary-fixed": "#d5e3fc",
                        "surface-container-lowest": "#ffffff",
                        "inverse-on-surface": "#eff1f3",
                        "primary-container": "#316bf3",
                        "inverse-primary": "#b4c5ff",
                        "surface": "#f7f9fb",
                        "tertiary-container": "#6a758a",
                        "secondary-container": "#d5e3fc",
                        "on-surface-variant": "#424754",
                        "on-error": "#ffffff",
                        "surface-container-highest": "#e0e3e5",
                        "primary": "#0051d5",
                        "on-secondary-container": "#57657a",
                        "tertiary-fixed": "#d8e3fb",
                        "surface-dim": "#d8dadc",
                        "tertiary-fixed-dim": "#bcc7de",
                        "on-surface": "#191c1e",
                        "surface-bright": "#f7f9fb",
                        "background": "#f7f9fb",
                        "on-secondary": "#ffffff",
                        "on-primary-container": "#fefcff",
                        "on-primary-fixed-variant": "#003ea8",
                        "on-background": "#191c1e",
                        "surface-variant": "#e0e3e5",
                        "error-container": "#ffdad6",
                        "outline": "#727785",
                        "on-primary-fixed": "#00174b",
                        "surface-tint": "#0053db",
                        "primary-fixed-dim": "#b4c5ff",
                        "secondary": "#515f74",
                        "on-secondary-fixed": "#0d1c2e",
                        "on-error-container": "#93000a",
                        "surface-container-low": "#f2f4f6",
                        "error": "#ba1a1a",
                        "on-tertiary-fixed-variant": "#3c475a"
                    },
                    fontFamily: {
                        "headline": ["Plus Jakarta Sans"],
                        "body": ["Inter"],
                        "label": ["Inter"]
                    },
                    borderRadius: {"DEFAULT": "0.25rem", "lg": "0.5rem", "xl": "1.5rem", "full": "9999px"},
                },
            },
        }
    </script>
<style>
        .material-symbols-outlined {
            font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
        }
        .ribbon-h {
            height: 4px;
            background-color: #c2c6d6;
            border-radius: 9999px;
        }
        .ribbon-v {
            width: 4px;
            background-color: #c2c6d6;
            border-radius: 9999px;
        }
    </style>
</head>
<body class="bg-surface font-body text-on-surface">
<!-- TopAppBar -->
<header class="fixed top-0 w-full z-50 flex justify-between items-center px-8 h-20 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-sm">
<div class="flex items-center gap-4">
<span class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white font-headline">Family Tree</span>
</div>
<nav class="hidden md:flex items-center gap-8 h-full">
<a class="h-full flex items-center px-2 text-blue-700 dark:text-blue-400 border-b-4 border-blue-700 font-headline font-bold text-lg transition-colors" href="#">Tree View</a>
<a class="h-full flex items-center px-2 text-slate-600 dark:text-slate-400 font-headline font-bold text-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" href="#">Archives</a>
</nav>
<div class="flex items-center gap-4">
<button class="px-6 py-2.5 rounded-xl bg-slate-100 text-slate-900 font-bold hover:bg-slate-200 active:scale-95 duration-200 cursor-pointer text-lg">
                Clear Database
            </button>
<button class="px-6 py-2.5 rounded-xl bg-gradient-to-r from-primary to-primary-container text-on-primary font-bold shadow-md active:scale-95 duration-200 cursor-pointer text-lg">
                Import GEDCOM
            </button>
</div>
</header>
<main class="pt-20 pr-80 min-h-screen">
<!-- Canvas Container -->
<div class="p-12 min-h-[calc(100vh-5rem)] flex items-center justify-start overflow-x-auto">
<!-- Pedigree Tree (Left-to-Right) -->
<div class="flex items-center gap-16 relative">
<!-- Generation 1 -->
<div class="flex flex-col gap-12 z-10">
<div class="w-64 p-6 bg-surface-container-lowest shadow-[0_20px_40px_rgba(25,28,30,0.06)] rounded-xl border-l-8 border-primary relative group">
<p class="text-secondary text-sm font-label mb-1">Great Grandparent</p>
<h3 class="text-on-surface font-headline font-bold text-xl mb-1">Arthur Miller</h3>
<p class="text-tertiary font-medium">1892 — 1974</p>
</div>
</div>
<!-- Ribbon Connector -->
<div class="w-16 ribbon-h"></div>
<!-- Generation 2 -->
<div class="flex flex-col gap-24 relative">
<!-- Top Branch -->
<div class="w-64 p-6 bg-surface-container-lowest shadow-[0_20px_40px_rgba(25,28,30,0.06)] rounded-xl border-l-8 border-secondary relative z-10">
<p class="text-secondary text-sm font-label mb-1">Grandparent</p>
<h3 class="text-on-surface font-headline font-bold text-xl mb-1">Robert Miller</h3>
<p class="text-tertiary font-medium">1921 — 1998</p>
</div>
<!-- Lower Branch -->
<div class="w-64 p-6 bg-surface-container-lowest shadow-[0_20px_40px_rgba(25,28,30,0.06)] rounded-xl border-l-8 border-secondary relative z-10">
<p class="text-secondary text-sm font-label mb-1">Grandparent</p>
<h3 class="text-on-surface font-headline font-bold text-xl mb-1">Alice Miller</h3>
<p class="text-tertiary font-medium">1925 — 2005</p>
</div>
<!-- Connection Ribbons -->
<div class="absolute -left-16 top-1/2 -translate-y-1/2 flex items-center">
<div class="h-48 ribbon-v absolute -left-0"></div>
</div>
</div>
<!-- Ribbon Connector -->
<div class="w-16 ribbon-h"></div>
<!-- Generation 3 (Focus: Jane Doe) -->
<div class="flex flex-col gap-12">
<div class="w-72 p-8 bg-white shadow-[0_20px_40px_rgba(0,81,213,0.12)] rounded-xl border-4 border-primary-fixed ring-4 ring-primary/5 z-20">
<div class="flex items-center justify-between mb-4">
<span class="px-3 py-1 bg-primary-fixed text-on-primary-fixed-variant text-xs font-bold rounded-full">SELECTED</span>
<span class="material-symbols-outlined text-primary">verified</span>
</div>
<p class="text-secondary text-sm font-label mb-1">Parent</p>
<h3 class="text-on-surface font-headline font-bold text-2xl mb-1">Jane Doe</h3>
<p class="text-primary font-bold text-lg">1960 — Present</p>
</div>
</div>
<!-- Ribbon Connector -->
<div class="w-16 ribbon-h"></div>
<!-- Generation 4 -->
<div class="flex flex-col gap-16">
<div class="w-64 p-6 bg-surface-container-lowest shadow-[0_20px_40px_rgba(25,28,30,0.06)] rounded-xl border-l-8 border-outline-variant">
<p class="text-secondary text-sm font-label mb-1">Child</p>
<h3 class="text-on-surface font-headline font-bold text-xl mb-1">Mark Doe</h3>
<p class="text-tertiary font-medium">1988 — Present</p>
</div>
<div class="w-64 p-6 bg-surface-container-lowest shadow-[0_20px_40px_rgba(25,28,30,0.06)] rounded-xl border-l-8 border-outline-variant">
<p class="text-secondary text-sm font-label mb-1">Child</p>
<h3 class="text-on-surface font-headline font-bold text-xl mb-1">Sarah Doe</h3>
<p class="text-tertiary font-medium">1992 — Present</p>
</div>
</div>
</div>
</div>
</main>
<!-- SideNavBar (Details Pane) -->
<aside class="fixed right-0 top-20 h-[calc(100vh-5rem)] flex flex-col p-8 z-40 w-80 bg-white shadow-2xl border-l-0">
<!-- Header -->
<div class="mb-10">
<div class="w-24 h-24 rounded-2xl bg-surface-container-high mb-6 overflow-hidden flex items-center justify-center">
<img alt="Jane Doe Profile" class="w-full h-full object-cover" data-alt="Close-up portrait of a woman in her 60s with gentle expression, soft natural window lighting, studio photography style" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCL9abje9MpkguS4KruHE2mCQUDMzqnvsYIXAvIwmdOGNZrwgw9S9sWb-VQWQpP3WZNzwLnKnPtaNyvXReylupzfxW_3e_saSrxCzxQizmtQOtoLLC5bTlopEmX_JTYUE7wwH2mMc7HEs5tSSSRpPt3CD3CcAzhulAMCRFgn7vZL33eRtoLofUU7EG2rTNzOqs0w9-Cb1vkecvY86DpEWBqOq0Wqq_KbkIJ88x4r5POCLe0zPR4Aa-f6gu1lfZjtOkftL9oS_0T0kg"/>
</div>
<h2 class="text-on-surface font-headline font-extrabold text-3xl mb-1">Jane Doe</h2>
<p class="text-secondary font-medium text-lg">Manage individual records</p>
</div>
<!-- Person Metadata -->
<div class="space-y-8 flex-grow">
<div class="bg-surface-container-low p-5 rounded-xl">
<p class="text-secondary text-sm font-bold uppercase tracking-wider mb-2">Sex</p>
<p class="text-on-surface font-headline font-semibold text-xl">Female</p>
</div>
<div class="bg-surface-container-low p-5 rounded-xl">
<p class="text-secondary text-sm font-bold uppercase tracking-wider mb-2">Birth Date</p>
<p class="text-on-surface font-headline font-semibold text-xl">01 JAN 1960</p>
</div>
<div class="bg-surface-container-low p-5 rounded-xl">
<p class="text-secondary text-sm font-bold uppercase tracking-wider mb-2">Place of Birth</p>
<p class="text-on-surface font-headline font-semibold text-xl">Boston, MA</p>
</div>
</div>
<!-- Sidebar Actions -->
<div class="mt-8 flex flex-col gap-4">
<button class="w-full py-4 rounded-xl bg-gradient-to-r from-primary to-primary-container text-on-primary font-bold text-xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-3">
<span class="material-symbols-outlined">add_circle</span>
                Add Relative
            </button>
<button class="w-full py-4 rounded-xl bg-secondary-container text-on-secondary-container font-bold text-xl active:scale-95 transition-all flex items-center justify-center gap-3">
<span class="material-symbols-outlined">edit</span>
                Edit Profile
            </button>
</div>
<!-- Footer Links -->
<div class="mt-10 pt-8 border-t border-slate-100 flex justify-between">
<button class="flex flex-col items-center gap-1 text-slate-500 hover:text-primary transition-colors">
<span class="material-symbols-outlined text-2xl" data-icon="settings">settings</span>
<span class="text-sm font-bold">Settings</span>
</button>
<button class="flex flex-col items-center gap-1 text-slate-500 hover:text-primary transition-colors">
<span class="material-symbols-outlined text-2xl" data-icon="help">help</span>
<span class="text-sm font-bold">Help</span>
</button>
</div>
</aside>
<!-- Contextual FAB (Only for main tree interactions) -->
<button class="fixed bottom-8 left-12 w-20 h-20 rounded-full bg-primary shadow-2xl text-white flex items-center justify-center z-50 active:scale-90 transition-transform md:hidden">
<span class="material-symbols-outlined text-4xl">add</span>
</button>
</body></html>