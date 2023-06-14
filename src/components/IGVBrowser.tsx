import React, { useLayoutEffect, useMemo, useState, useEffect } from "react";
import igv from "igv/dist/igv.esm";
import noop from "lodash.noop";
import find from "lodash.find";
import {
  GWASServiceTrack as GWASTrack,
  VariantServiceTrack as VariantTrack,
} from "@tracks/index";
import { _genomes } from "@data/_igvGenomes";
import { TrackBaseOptions } from "@browser-types/tracks";
import { resolveTrackReader, loadTrack } from "@utils/index";

export const DEFAULT_FLANK = 1000;

interface IGVBrowserProps {
  featureSearchUrl: string;
  genome: string;
  locus?: string;
  onTrackRemoved?: (track: string) => void;
  onBrowserLoad?: (Browser: any) => void;
  tracks: TrackBaseOptions[];
}

const IGVBrowser: React.FC<IGVBrowserProps> = ({
  featureSearchUrl,
  genome,
  locus,
  onBrowserLoad,
  onTrackRemoved,
  tracks,
}) => {
  const [browserIsLoaded, setBrowserIsLoaded] = useState<boolean>(false);
  const [browser, setBrowser] = useState<any>(null);

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
      if (browserIsLoaded && memoOptions) {
        for (let track of tracks) {
           // if a service track, assign the reader
            if (track.type.includes("_service")) {
              track.reader = resolveTrackReader(track.type, {
                endpoint: track.url,
                track: track.id,
              });
            }

            // load
            browser.loadTrack(track)
        }
      }
  }, [browserIsLoaded, memoOptions, tracks])

  useLayoutEffect(() => {
    window.addEventListener("ERROR: Genome Browser - ", (event) => {
      console.log(event);
    });

    const targetDiv = document.getElementById("genome-browser");
    if (memoOptions != null) {
      igv.createBrowser(targetDiv, memoOptions).then(function (browser: any) {
        // browser is initialized and can now be used

        // browser.on("trackclick", _customTrackPopup);

        // perform action in encapsulating component if track is removed
        browser.on("trackremoved", function (track: any) {
          onTrackRemoved && onTrackRemoved(track.config.id);
        });

        browser.addTrackToFactory(
          "gwas_service",
          (config: any, browser: any) => new GWASTrack(config, browser)
        );

        browser.addTrackToFactory(
          "variant_service",
          (config: any, browser: any) => new VariantTrack(config, browser)
        );

        setBrowser(browser);
        onBrowserLoad ? onBrowserLoad(browser) : noop();
        setBrowserIsLoaded(true);
      });
    }
  }, [onBrowserLoad, memoOptions]);

  return <span style={{ width: "100%" }} id="genome-browser" />;
};

export const MemoIGVBrowser = React.memo(IGVBrowser);
export default IGVBrowser;