export function ticketUrl(value) {
  const u = new URL(value);
  if (!['www.ticketportal.cz','ticketportal.cz'].includes(u.hostname) || u.username || u.password || u.port) throw Error('Neplatný odkaz Ticketportalu.');
  const id = u.pathname.match(/^\/performance\/(\d+)$/)?.[1] || (/^\/predstavenie_javisko_view\.asp$/i.test(u.pathname) && u.searchParams.get('IDPred'));
  if (!id || !/^\d+$/.test(id)) throw Error('Odkaz musí vést na konkrétní termín představení.');
  return `https://www.ticketportal.cz/performance/${id}?idpartner=91`;
}
