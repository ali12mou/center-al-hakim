import { createContext, useContext, useMemo } from "react";
import {
  can,
  canModule,
  isSuperAdmin,
} from "../../../../Backend/config/permissions.js";

// Compte connecté et ses droits : l’interface masque ce que le Backend refuserait.
const AdminContext = createContext(null);

export function AdminProvider({ user, children }) {
  const value = useMemo(
    () => ({
      user,
      superAdmin: isSuperAdmin(user),
      can: (section, action = "view") => can(user, section, action),
      canModule: (module) => canModule(user, module),
    }),
    [user],
  );
  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}
export const useAdmin = () => useContext(AdminContext);
