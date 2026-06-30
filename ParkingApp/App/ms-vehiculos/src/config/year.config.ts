const CURRENT_YEAR = new Date().getFullYear();
const MAX_YEAR = CURRENT_YEAR + 1;

process.env.CURRENT_YEAR = process.env.CURRENT_YEAR ?? CURRENT_YEAR.toString();

export { CURRENT_YEAR, MAX_YEAR };
