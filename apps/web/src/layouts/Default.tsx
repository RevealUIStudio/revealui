import {App} from "reveal/ui/shells";
import "./style.css";

import "./tailwind.css";

import React from "react";

export default function Layout({ children }: { children: React.ReactNode }) {
    return (
        
        <App>
           
        {children}
      
        </App>
       
    );
    }

