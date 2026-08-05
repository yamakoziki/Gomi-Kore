import { useCallback, useState } from "react";

export type GeolocationState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; latitude: number; longitude: number }
  | { status: "error"; code: "unsupported" | "denied" | "unavailable" };

export function useGeolocation() {
  const [state, setState] = useState<GeolocationState>({ status: "idle" });

  const requestLocation = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState({ status: "error", code: "unsupported" });
      return;
    }
    setState({ status: "loading" });
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setState({
          status: "success",
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => {
        setState({
          status: "error",
          code: error.code === error.PERMISSION_DENIED ? "denied" : "unavailable",
        });
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  }, []);

  return { state, requestLocation };
}
