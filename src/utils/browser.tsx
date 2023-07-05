import { Session, TrackBaseOptions, IGVTrackOptions } from "@browser-types/tracks";
import { decodeBedXY } from "@decoders/bedDecoder";
import { resolveTrackReader } from "./tracks";
import { get } from "lodash"

const ALWAYS_ON_TRACKS = ["ideogram", "ruler", "sequence", "ENSEMBL_GENE"];

// functions for maninpulating IGV browser object
export const loadTrack = async (config: any, browser: any) => {
    await browser.loadTrack(config);
};

export const loadTracks = (tracks: TrackBaseOptions[], browser: any) => {
  for (let track of tracks as IGVTrackOptions[]) {

      if (track.type.includes("_service")) {
        track.reader = resolveTrackReader(track.type, {
          endpoint: track.url,
          track: track.id,
        });
      }
      if("format" in track){
        if(track.format.match("^bed\\d{1,2}\\+\\d+$") != null){ // does it match bedX+Y?
          track.decode = decodeBedXY
        }
      }
      // load
      browser.loadTrack(track)
  }
}

export const createSessionObj = (tracks: TrackBaseOptions[]): Session => {
  
  tracks = tracks.filter(track => !(track.id === "reference"))

  //TODO: locus and roi are currently set to default values
  let sessionObj: Session = {
    tracks: tracks,
    roi: [],
    locus: "chr19:1,038,997-1,066,572",
  }

  return sessionObj
}

export const removeNonReferenceTracks = (tracks: TrackBaseOptions[], browser: any) => {
  for(let track of tracks) {
    if(track.id !== "REFSEQ_GENE" && track.id !== "ENSEMBL_GENE"){
      browser.removeTrackByName(track.name)
    }
  }
}