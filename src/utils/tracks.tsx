import get from "lodash.get";
import { ALWAYS_ON_TRACKS } from "@data/_constants";
import VariantServiceReader  from "@readers/VariantServiceReader"
import GWASServiceReader from "@readers/GWASServiceReader"
import { Session, TrackBaseOptions } from "@browser-types/tracks";
import { loadTracks } from "./browser";

export const getTrackID = (trackView: any) => {
    const track = trackView.track;
    return "id" in track ? track.id : track.config.id;
};

export const getLoadedTracks = (browser: any): string[] =>
    get(browser, "trackViews", [])
        .map((view: any) => getTrackID(view))
        .filter((track: string) => !ALWAYS_ON_TRACKS.includes(track));

export const trackIsLoaded = (config: any, browser: any) => getLoadedTracks(browser).includes(config.id);

// we want to find track by ID b/c some names may be duplicated; so modeled after:
// https://github.com/igvteam/igv.js/blob/0dfb1f7b02d9660ff1ef0169899c4711496158e8/js/browser.js#L1104
export const removeTrackById = (trackId: string, browser: any) => {
    const trackViews = get(browser, "trackViews", []);
    const trackView = trackViews.filter((view: any) => getTrackID(view) === trackId);
    browser.removeTrack(trackView[0].track);
};

export const resolveTrackReader = (trackType: string, config: any): any => {
    switch (trackType) {
        case "gwas_service":
            return new GWASServiceReader(config);
        case "variant_service":
            return new VariantServiceReader(config);
        default:
            return null;
    }
};

export const removeAndLoadTracks = (tracks: TrackBaseOptions[], browser: any) => {
    const loadedTracks = getLoadedTracks(browser);
        // if any tracks are loaded, remove them
        if (Object.keys(loadedTracks).length !== 0) {
          for (let id of loadedTracks) {
            removeTrackById(id, browser);
          }
        }
  
        // load the new tracks
        loadTracks(tracks, browser);
  }

export const onTrackRemoved = (id: string, setSessionJSON: any) => {
    //use functional form of setter to get up to date sessionJSON
    setSessionJSON((sessionJSON : Session) => {
        for(let track of sessionJSON.tracks) {
            if(track.id === id) {
                sessionJSON.tracks = sessionJSON.tracks.filter(track => track.id !== id)
                return sessionJSON
            }
        }
        return sessionJSON
    })
    
}

export const selectTracksFromURLParams = (availableTracks: TrackBaseOptions[], URLTracks: string[]): TrackBaseOptions[] => {
    const selectedTracks = []
    for(let trackName in URLTracks) {
        for(let track of availableTracks){
            if(track.name === trackName) selectedTracks.push(track)
        }
    }
    return selectedTracks
}