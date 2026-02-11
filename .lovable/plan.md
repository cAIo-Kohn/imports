
## Replace Logo with MOR Image Across the App

### What Changes
Replace the Package icon currently used as logo in the login page, sidebar header, and favicon with the uploaded MOR logo image. Apply Apple-style rounded corners (`rounded-[22%]`).

### Steps

**1. Copy the uploaded image to the project**
- Copy `user-uploads://Design_sem_nome_8.png` to `src/assets/mor-logo.png` (for React components)
- Copy to `public/mor-logo.png` (for favicon in index.html)

**2. Update `src/pages/Auth.tsx`**
- Import the logo: `import morLogo from "@/assets/mor-logo.png"`
- Replace the `<Package>` icon block (lines 81-84) with an `<img>` tag using the logo, sized ~56px (`h-14 w-14`), with `rounded-[22%]` for Apple-style corners

**3. Update `src/components/layout/AppSidebar.tsx`**
- Import the logo: `import morLogo from "@/assets/mor-logo.png"`
- Replace `<Package className="h-8 w-8 ...">` (line 46) with an `<img>` tag sized 32px (`h-8 w-8`), with `rounded-[22%]`

**4. Update `index.html`**
- Change the favicon `<link>` to reference `/mor-logo.png`

### Sizing
- **Sidebar**: 32x32px (h-8 w-8) -- matches current Package icon size
- **Login page**: 56x56px (h-14 w-14) -- matches current icon container size
- **Favicon**: browser default (from public/)
- All with `rounded-[22%]` for Apple-style superellipse corners
