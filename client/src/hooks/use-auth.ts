import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { onAuthStateChanged, signOut, type User as FirebaseUser } from "firebase/auth";
import type { User } from "@shared/models/auth";
import { clearOfflineSyncStorage } from "@/hooks/use-offline-sync";
import { firebaseAuth } from "@/lib/firebase";

async function fetchUser(): Promise<User | null> {
  const token = await firebaseAuth.currentUser?.getIdToken();
  if (!token) {
    return null;
  }

  const response = await fetch("/api/auth/user", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`${response.status}: ${response.statusText}`);
  }

  return response.json();
}

async function logout(): Promise<void> {
  if (navigator.serviceWorker?.controller) {
    navigator.serviceWorker.controller.postMessage({ type: "CLEAR_USER_CACHE" });
  }
  clearOfflineSyncStorage();
  await signOut(firebaseAuth);
}

export function useAuth() {
  const queryClient = useQueryClient();
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(firebaseAuth.currentUser);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(firebaseAuth, (user) => {
      setFirebaseUser(user);
      setAuthReady(true);
      if (!user) {
        queryClient.setQueryData(["/api/auth/user"], null);
      } else {
        queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      }
    });

    return () => unsub();
  }, [queryClient]);

  const { data: user, isLoading } = useQuery<User | null>({
    queryKey: ["/api/auth/user"],
    queryFn: fetchUser,
    retry: false,
    staleTime: 1000 * 60 * 5, // 5 minutes
    enabled: authReady && !!firebaseUser,
  });

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.setQueryData(["/api/auth/user"], null);
      queryClient.clear();
    },
  });

  return {
    user: firebaseUser ? user ?? null : null,
    isLoading: !authReady || isLoading,
    isAuthenticated: !!firebaseUser && !!user,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
  };
}
