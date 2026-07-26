import { loadLiveOfferUnits } from "../_data/warRoomUnits";
import { WarRoomClient } from "./_components/WarRoomClient";

// Live inventory must be read at request time, never frozen into the build.
export const dynamic = "force-dynamic";

export const metadata = { title: "Pro Mode · Alwalaa OS" };

export default async function ProModePage() {
  const liveUnits = await loadLiveOfferUnits();
  return <WarRoomClient liveUnits={liveUnits ?? []} />;
}
