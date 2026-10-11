// Whose lesson this is. The same quiz is published twice: by Tribe of Abraham (the default, at
// learn.tribeofabraham.com/cmi5/) and by Ragamuffin Studios (VITE_BRAND=studios, built into
// ragamuffinstudios.com/cmi5/ by that site's deploy). Each is its own cmi5 course, with its own
// permanent ids, so an LMS keeps their records apart.
import toaLogo from './assets/LogoOnly.svg'
import studiosLogo from './assets/studios-logo.svg'

const BRANDS = {
  toa: {
    id: 'toa', name: 'Tribe of Abraham', app: 'E-Learning', home: 'https://tribeofabraham.com',
    logo: toaLogo, ids: 'https://tribeofabraham.com/xapi/cmi5-react',
  },
  studios: {
    id: 'studios', name: 'Ragamuffin Studios', app: 'cmi5', home: 'https://ragamuffinstudios.com',
    logo: studiosLogo, ids: 'https://ragamuffinstudios.com/xapi/cmi5',
  },
}

export const BRAND = BRANDS[import.meta.env.VITE_BRAND] ?? BRANDS.toa
