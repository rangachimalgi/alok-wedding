import { progress } from './progress.js';
import { cache } from '../../connection/cache.js';

export const image = (() => {

    /**
     * @type {NodeListOf<HTMLImageElement>|null}
     */
    let images = null;

    /**
     * @type {ReturnType<typeof cache>|null}
     */
    let c = null;

    /**
     * @type {object[]}
     */
    const urlCache = [];

    /**
     * @param {string} src 
     * @returns {Promise<HTMLImageElement>}
     */
    const loadedImage = (src) => new Promise((res, rej) => {
        const i = new Image();
        i.onload = () => res(i);
        i.onerror = rej;
        i.src = src;
    });

    /**
     * @param {HTMLImageElement} el 
     * @param {string} src 
     * @returns {Promise<void>}
     */
    const appendImage = (el, src, withProgress) => loadedImage(src).then((img) => {
        el.width = img.naturalWidth;
        el.height = img.naturalHeight;
        el.classList.remove('opacity-0');
        el.src = img.src;
        img.remove();

        if (withProgress) {
            progress.complete('image');
        }
    });

    /**
     * @param {HTMLImageElement} el 
     * @returns {void}
     */
    const getByFetch = (el, withProgress) => {
        urlCache.push({
            url: el.getAttribute('data-src'),
            res: (url) => appendImage(el, url, withProgress),
            rej: (err) => {
                console.error(err);
                if (withProgress) {
                    progress.invalid('image');
                }
            },
        });
    };

    /**
     * @param {HTMLImageElement} el 
     * @returns {void}
     */
    const getByDefault = (el, withProgress) => {
        el.onerror = () => {
            if (withProgress) {
                progress.invalid('image');
            }
        };
        el.onload = () => {
            el.width = el.naturalWidth;
            el.height = el.naturalHeight;
            if (withProgress) {
                progress.complete('image');
            }
        };

        if (el.complete && el.naturalWidth !== 0 && el.naturalHeight !== 0) {
            if (withProgress) {
                progress.complete('image');
            }
        } else if (el.complete) {
            if (withProgress) {
                progress.invalid('image');
            }
        }
    };

    /**
     * @returns {boolean}
     */
    const hasDataSrc = () => Array.from(images).some((i) => i.hasAttribute('data-src'));

    /**
     * @returns {Promise<void>}
     */
    const load = async () => {
        const imgs = Array.from(images);

        /**
         * @param {function} filter 
         * @returns {Promise<void>}
         */
        const runGroup = async (filter, withProgress) => {
            urlCache.length = 0;
            imgs.filter(filter).forEach((el) => el.hasAttribute('data-src') ? getByFetch(el, withProgress) : getByDefault(el, withProgress));
            await c.run(urlCache, progress.getAbort());
        };

        // First paint: only critical images are part of loading progress.
        await runGroup((el) => el.hasAttribute('fetchpriority'), true);

        // Defer non-critical images so the invitation opens faster.
        runGroup((el) => !el.hasAttribute('fetchpriority'), false).catch((err) => console.error(err));
    };

    /**
     * @param {string} blobUrl 
     * @returns {void}
     */
    const download = (blobUrl) => {
        c.download(blobUrl, `${window.location.hostname}_image_${Date.now()}`);
    };

    /**
     * @returns {object}
     */
    const init = () => {
        c = cache('image').withForceCache();
        images = document.querySelectorAll('img');
        images.forEach((img) => {
            if (img.hasAttribute('fetchpriority')) {
                progress.add();
            }
        });

        return {
            load,
            download,
            hasDataSrc,
        };
    };

    return {
        init,
    };
})();