import React, { useLayoutEffect, useMemo, useState, useEffect, useRef } from "react";
import igv from "igv/dist/igv.esm";
import noop from "lodash.noop";
import find from "lodash.find";
import isEqual from "lodash.isequal";
import {
  VariantPValueTrack,
  VariantServiceTrack as VariantTrack,
  trackPopover,
} from "@tracks/index";
import { _genomes } from "@data/_igvGenomes";
import { ROISet, Session, TrackBaseOptions } from "@browser-types/tracks";
import {
  loadTracks,
  createSessionObj,
  downloadObjectAsJson,
  getLoadedTracks,
  removeTrackById,
  removeAndLoadTracks,
  createLocusString,
  selectTracksFromURLParams
} from "@utils/index";
import { decodeBedXY } from "@decoders/bedDecoder";
import LoadSession from "./LoadSession";
import SaveSession from "./SaveSession";
import { useSessionStorage } from "usehooks-ts";
import AddTracksButton from "./AddTracksButton";
import { ReferenceFrame } from "@browser-types/browserObjects";

export const DEFAULT_FLANK = 1000;
export const URL_PARAMETER_NAMES = ["tracks", "locus", "roi"]

interface IGVBrowserProps {
  featureSearchUrl: string;
  genome: string;
  locus?: string;
  onTrackRemoved?: (track: string, setSessionJSON: any) => void;
  onBrowserLoad?: (Browser: any) => void;
  updateSessionLocus?: (locusString: string, setSessionJSON: any) => void;
  tracks: TrackBaseOptions[];
}

const IGVBrowser: React.FC<IGVBrowserProps> = ({
  featureSearchUrl,
  genome,
  locus,
  onBrowserLoad,
  onTrackRemoved,
  updateSessionLocus,
  tracks,
}) => {
  const [browserIsLoaded, setBrowserIsLoaded] = useState<boolean>(false);
  const [browser, setBrowser] = useState<any>(null);
  const [sessionJSON, setSessionJSON] = useSessionStorage<Session>('sessionJSON', null)
  const [URLParamsState, setURLParamsState] = useState(null)
  const isDragging = useRef<boolean>(false)

  useEffect(() => {
    //get URL parameters
    const url = new URL(window.location.href)
    const params: any = {}
    for(let param of URL_PARAMETER_NAMES){
      let value = url.searchParams.get(param)
      if(value) params[param] = value
    }
    setURLParamsState(params)
  }, [])

  useEffect(() => {
    if(URLParamsState) console.log(URLParamsState)
  }, [URLParamsState])
  
  
  const memoOptions: any = useMemo(() => {
    const referenceTrackConfig: any = find(_genomes, { id: genome });
    return {
      locus: locus || "ABCA7",
      showAllChromosomes: false,
      flanking: DEFAULT_FLANK,
      minimumBases: 40,
      search: {
        url: `${featureSearchUrl}$FEATURE$&flank=${DEFAULT_FLANK}`,
      },
      reference: {
        id: genome,
        name: referenceTrackConfig.name,
        fastaURL: referenceTrackConfig.fastaURL,
        indexURL: referenceTrackConfig.indexURL,
        cytobandURL: referenceTrackConfig.cytobandURL,
        tracks: referenceTrackConfig.tracks,
      },
      loadDefaultGenomes: false,
      genomeList: _genomes,
    };
  }, [genome, locus]);

  useEffect(() => {
    // setting initial session due to component load/reload
    if (browserIsLoaded && memoOptions && tracks) {
      if(sessionJSON != null) {
        removeAndLoadTracks(sessionJSON.tracks, browser);
        if(sessionJSON.hasOwnProperty("roi")) removeAndLoadROIs(sessionJSON.roi, browser);
        if(sessionJSON.hasOwnProperty("locus")) browser.search(sessionJSON.locus)
      }
      //assuming session takes precedence over URL params
      else if(URLParamsState) {
        if(URLParamsState.hasOwnProperty('tracks')) {
          sessionJSON.tracks = selectTracksFromURLParams(tracks, URLParamsState.tracks)
          removeAndLoadTracks(sessionJSON.tracks, browser)
          setSessionJSON(sessionJSON)
        }
        if(URLParamsState.hasOwnProperty('locus')){
          sessionJSON.locus = URLParamsState.locus
          browser.search(sessionJSON.locus)
          setSessionJSON(sessionJSON)
        }
        if(URLParamsState.hasOwnProperty('roi')){
          sessionJSON.roi = URLParamsState.roi
          
          removeAndLoadROIs(sessionJSON.roi)
        }

      }
      else {
        removeAndLoadTracks(tracks, browser);
        setSessionJSON(createSessionObj(tracks));
      }
    }
  }, [browserIsLoaded, memoOptions, tracks, URLParamsState]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      //check to see if current ROIs are different than the past ROIs
      // && browser.roiManager.roiSets.length !== 0 &&!isEqual(prevROI, JSON.parse(JSON.stringify(browser.roiManager.roiSets)))
      if(browser && browser.roiManager.roiSets.length !== 0){
        const currentROIs = browser.getUserDefinedROIs()
        if(!isEqual(currentROIs, JSON.parse(JSON.stringify(browser.roiManager.roiSets)))){
          const ROISets = JSON.parse(JSON.stringify(browser.roiManager.roiSets))
          let updatedSession: Session = null
          if(sessionJSON) updatedSession = sessionJSON
          //if there's no session then create one with default tracks and locus
          else updatedSession = createSessionObj(tracks)
          updatedSession.roi = ROISets
          setSessionJSON(updatedSession)
        }
      }
    }, 1000);
    
    return () => clearInterval(intervalId);
  }, [browserIsLoaded, browser]);

  const removeAndLoadROIs = (ROIs: ROISet[], browser: any) => {
    console.log("ROIs: ", ROIs)
    browser.clearROIs()
    browser.loadROI(ROIs)
  }
  useLayoutEffect(() => {
    window.addEventListener("ERROR: Genome Browser - ", (event) => {
      console.log(event);
    });

    const targetDiv = document.getElementById("genome-browser");

    if (memoOptions != null) {
      igv.registerTrackClass("gwas_service", VariantPValueTrack);
      igv.registerTrackClass("eqtl", VariantPValueTrack);
      igv.registerTrackClass("variant_service", VariantTrack);

      igv.createBrowser(targetDiv, memoOptions).then(function (browser: any) {
        // custom track popovers
        browser.on("trackclick", trackPopover);

        // perform action in encapsulating component if track is removed
        //callback does not get the updated value of sessionJSON so functional form of the setter is used
        browser.on("trackremoved", function (track: any) {
          onTrackRemoved && onTrackRemoved(track.config.id, setSessionJSON);
        });

        browser.on("locuschange", function (referenceFrameList: ReferenceFrame[]) {
          !isDragging.current && sessionJSON && 
          updateSessionLocus(createLocusString(referenceFrameList), setSessionJSON)
        })

        browser.on("trackdrag", function () {
          if(!isDragging.current){
            isDragging.current = true
          } 

        })

        browser.on("trackdragend", function () {
          isDragging.current = false
          const currentLoci: string = browser.currentLoci()
          updateSessionLocus(currentLoci, setSessionJSON)
        })

        // add browser to state
        setBrowser(browser);
        setBrowserIsLoaded(true);

        // callback to parent component, if exist
        onBrowserLoad ? onBrowserLoad(browser) : noop();
      });
    }
  }, [onBrowserLoad, memoOptions]);

  //rearrange
  const handleSaveSession = () => {
    if (browserIsLoaded) {
      let sessionObj = createSessionObj(sessionJSON.tracks);
      downloadObjectAsJson(sessionObj, "NIAGADS_IGV_session");
    } else {
      alert("Wait until the browser is loaded before saving");
    }
  };

  const handleLoadFileClick = (jsonObj: Session) => {
    removeAndLoadTracks(jsonObj.tracks, browser);
    const newSession = createSessionObj(jsonObj.tracks);
    setSessionJSON(newSession);

  }

  return (
    <>
      <LoadSession handleLoadFileClick={handleLoadFileClick} />
      <SaveSession handleSave={handleSaveSession} />
      <AddTracksButton browser={browser} sessionJSON={sessionJSON} setSessionJSON={setSessionJSON} />
      <span style={{ width: "100%" }} id="genome-browser" />
    </>
  );
};

export const MemoIGVBrowser = React.memo(IGVBrowser);
export default IGVBrowser;
