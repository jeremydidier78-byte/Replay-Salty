# Replay Salty — version complète (starter)

Application Next.js + Supabase : comptes, pseudos, publication de replays par lien ou fichier, liste publique et recherche.

## Prérequis
- Node.js 20 ou supérieur
- Un compte Supabase
- Un compte GitHub et Vercel pour le déploiement

## 1. Créer la base et le stockage
1. Créez un projet sur https://supabase.com.
2. Ouvrez **SQL Editor** dans le tableau de bord Supabase.
3. Copiez et exécutez `supabase/schema.sql`.
4. Dans **Authentication > URL Configuration**, configurez l'URL locale `http://localhost:3000` et ajoutez l'URL finale de production après le déploiement.
5. Pour les tests, désactivez la confirmation e-mail seulement si vous comprenez les conséquences. En production, gardez la confirmation activée et configurez un fournisseur e-mail.

## 2. Configurer l'application
1. Copiez `.env.example` vers `.env.local`.
2. Renseignez l'URL du projet Supabase et la clé publique/publishable (ou anon) trouvée dans **Project Settings > API**.
3. Ne mettez JAMAIS de clé `service_role` dans une variable `NEXT_PUBLIC_*`, dans le navigateur ou dans Git.

## 3. Lancer en local
```bash
npm install
npm run dev
```
Ouvrez http://localhost:3000.

## 4. Mettre en ligne
1. Envoyez ce projet dans un dépôt GitHub privé ou public.
2. Sur https://vercel.com, importez le dépôt.
3. Vercel détecte Next.js automatiquement.
4. Dans **Project Settings > Environment Variables**, ajoutez `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
5. Déployez puis ajoutez le domaine Vercel (ou votre domaine personnalisé) aux URL autorisées de Supabase Auth.
6. Testez inscription, confirmation e-mail, connexion, publication et accès public en navigation privée.

## Fonctionnalités du starter
- Inscription / connexion par e-mail et mot de passe.
- Pseudo de profil.
- Publication de replay avec URL et/ou fichier (limite prototype : 50 Mo).
- Liste publique des replays, recherche texte et filtre par jeu.
- Règles RLS pour les profils, replays et stockage.

## À compléter avant ouverture publique
Cette base est un point de départ fonctionnel, pas une plateforme auditée ou prête à recevoir une forte audience.
- Dans cette version, les fichiers sont dans un bucket public car les replays sont publics. Toute personne disposant de l’URL du fichier peut l’ouvrir. Pour proposer des replays privés/non répertoriés, basculez vers un bucket privé et ajoutez une route serveur qui vérifie les droits avant de générer une URL signée.
- Ajouter modification/suppression des replays et une vraie page profil publique.
- Ajouter modération, signalement, limites anti-spam, CAPTCHA/rate limiting, pagination et validation stricte des types de fichiers.
- Les formats de replay diffèrent selon les jeux : certains sont des fichiers texte/données, d'autres sont des vidéos ou des liens externes. Il faut définir les formats réellement acceptés avant d'ouvrir l'upload.
- Vérifier les règles de conservation, la politique de confidentialité, les conditions d'utilisation, le droit d'auteur et la protection des mineurs selon le public visé.
- Ajouter des tests et surveiller les erreurs / coûts de stockage.
- Les vidéos peuvent coûter cher à stocker et diffuser. Pour de gros fichiers, utiliser un hébergeur vidéo dédié plutôt que Supabase Storage.

## Architecture
- Frontend et hébergement : Vercel (Next.js).
- Authentification, PostgreSQL, Row Level Security et fichiers : Supabase.
- Pas de clé secrète côté client ; l'accès est contrôlé par les politiques RLS.
