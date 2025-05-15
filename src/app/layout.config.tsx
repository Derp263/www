import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared'
import { BookOpen, CircleDollarSign, Info, Trophy, Upload, Users } from 'lucide-react'
import { Header } from './_components/header'

const links = [
  {
    text: 'Documentation',
    url: '/docs',
    icon: <BookOpen />,
  },
  {
    text: 'Leaderboards',
    url: '/leaderboards',
    icon: <Trophy />,
  },
  {
    text: 'Ranked Queue',
    url: '/queue',
    icon: <Users />,
  },
  {
    text: 'About',
    url: '/about',
    icon: <Info />,
  },
  {
    text: 'Major League Balatro',
    url: '/major-league-balatro',
  },
  {
    text: 'Support Mod Development',
    url: 'https://ko-fi.com/virtualized/shop',
    icon: <CircleDollarSign />,
  },
  {
    text: 'Fix Corrupted Profile',
    url: '/profile-fix',
    icon: <Upload />,
  },
  // {
  //   text: 'Credits',
  //   url: '/credits',
  //   icon: <Award />,
  // },
]
const nav = {
  title: (
    <div className='flex items-center space-x-2'>
      <img src={'/logo.png'} alt={'Balatro Multiplayer'} className={'size-8'} />
      <span className='inline-block font-bold'>Balatro Multiplayer</span>
    </div>
  ),
}
export const baseOptions: BaseLayoutProps = {
  links,
  nav: {
    ...nav,
    component: <Header finalLinks={links} nav={nav} />,
  },
}
