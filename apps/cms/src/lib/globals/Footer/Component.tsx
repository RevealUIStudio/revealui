import { getCachedGlobal } from '../../utilities/getGlobals'
import Link from 'next/link'
import React from 'react'
import { ThemeSelector } from '../../providers/Theme/ThemeSelector'
import { CMSLink } from '../../components/Link'
import { Config } from '@revealui/cms'

// Define the NavItem type with constrained type property
export interface NavItem {
  link: {
    type?: 'custom' | 'reference' | null // Constrain type to specific values
    url?: string | null // Optional URL for custom links
    reference?: {
      relationTo: 'pages' | 'posts' // Relation type
      value: string | number // Reference value (ID or slug)
    } | null // Reference link
  }
}

// Define the FooterType interface
export interface FooterType {
  navItems: NavItem[] // Array of navigation items
}

// Define the Footer component
export async function Footer() {
  // Ensure "footer" is a valid key in Config["globals"]
  const footer = (await getCachedGlobal('footer' as keyof Config['globals'])()) as FooterType | null

  const navItems = footer?.navItems || []

  return (
    <footer className="border-t border-border bg-black dark:bg-card text-white">
      <div className="container py-8 gap-8 flex flex-col md:flex-row md:justify-between">
        <Link className="flex items-center" href="/">
          <picture>
            <img
              alt="RevealUI Logo"
              className="max-w-24 invert-0"
              src="https://raw.githubusercontent.com/revealui/revealui/main/packages/revealui/src/assets/images/revealui-logo-light.svg"
            />
          </picture>
        </Link>

        <div className="flex flex-col-reverse items-start md:flex-row gap-4 md:items-center">
          <ThemeSelector />
          <nav className="flex flex-col md:flex-row gap-4">
            {navItems.map(({ link }) => {
              // Prefer a unique key for each nav item, fallback to url, reference.value, or 'unknown'
              const key =
                link.url ??
                (link.reference
                  ? `${link.reference.relationTo}:${link.reference.value}`
                  : undefined) ??
                'unknown'

              return <CMSLink className="text-white" key={key} {...link} />
            })}
          </nav>
        </div>
      </div>
    </footer>
  )
}

// import { getCachedGlobal } from "../../utilities/getGlobals";
// import Link from "next/link";
// import React from "react";
// import { ThemeSelector } from "../../providers/Theme/ThemeSelector";
// import { CMSLink } from "../../components/Link";

// export interface FooterType {

// }
// export async function Footer() {
//   const footer: FooterType = await getCachedGlobal("footer")();

//   const navItems = footer?.navItems || [];

//   return (
//     <footer className="border-t border-border bg-black dark:bg-card text-white">
//       <div className="container py-8 gap-8 flex flex-col md:flex-row md:justify-between">
//         <Link className="flex items-center" href="/">
//           <picture>
//             <img
//               alt="Payload Logo"
//               className="max-w-24 invert-0"
//               src="https://raw.githubusercontent.com/payloadcms/payload/main/packages/payload/src/admin/assets/images/payload-logo-light.svg"
//             />
//           </picture>
//         </Link>

//         <div className="flex flex-col-reverse items-start md:flex-row gap-4 md:items-center">
//           <ThemeSelector />
//           <nav className="flex flex-col md:flex-row gap-4">
//             {navItems.map(({ link }, i) => {
//               return <CMSLink className="text-white" key={i} {...link} />;
//             })}
//           </nav>
//         </div>
//       </div>
//     </footer>
//   );
// }
