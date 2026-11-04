/**
 * Get the current params from ReactRouter
 *
 * @returns an object with the current ReactRouter params
 *
 * @example
 * import { useParams } from "decky-frontend-lib";
 *
 * const { appid } = useParams<{ appid: string }>()
 */
export declare const useParams: <T>() => T;
