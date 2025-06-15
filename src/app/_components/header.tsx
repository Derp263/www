'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { auth } from '@/server/auth'
import { ThemeToggle } from 'fumadocs-ui/components/layout/theme-toggle'
import type { HomeLayoutProps } from 'fumadocs-ui/layouts/home'
import type { LinkItemType } from 'fumadocs-ui/layouts/links'
import { replaceOrDefault } from 'fumadocs-ui/layouts/shared'
import { LogIn, LogOut, Tv, User } from 'lucide-react'
import { signIn, signOut, useSession } from 'next-auth/react'
import Link from 'next/link'
import { Fragment } from 'react'
import { Menu, MenuContent, MenuLinkItem, MenuTrigger } from './home/menu'
import {
  NavbarLink,
  NavbarMenu,
  NavbarMenuContent,
  NavbarMenuLink,
  NavbarMenuTrigger,
} from './home/navbar'
import { Navbar } from './home/navbar'
import { LargeSearchToggle, SearchToggle } from './search-toggle'

export async function Header({
  nav: { enableSearch = true, ...nav } = {},
  finalLinks,
  themeSwitch,
}: HomeLayoutProps & {
  finalLinks: LinkItemType[]
}) {
  const session = await auth()
  const isAuthenticated = session?.user
  const navItems = finalLinks.filter((item) =>
    ['nav', 'all'].includes(item.on ?? 'all')
  )
  const menuItems = finalLinks.filter((item) =>
    ['menu', 'all'].includes(item.on ?? 'all')
  )

  return (
    <Navbar>
      <Link
        href={nav.url ?? '/'}
        className='inline-flex items-center gap-2.5 font-semibold'
      >
        {nav.title}
      </Link>
      {nav.children}
      <ul className='flex flex-row items-center gap-2 px-6 max-sm:hidden'>
        {navItems
          .filter((item) => !isSecondary(item))
          .map((item, i) => (
            <NavbarLinkItem key={i} item={item} className='text-sm' />
          ))}
      </ul>
      <div className='flex flex-1 flex-row items-center justify-end gap-1.5'>
        {enableSearch ? (
          <>
            <SearchToggle className='lg:hidden' hideIfDisabled />
            <LargeSearchToggle
              className='w-full max-w-[240px] max-lg:hidden'
              hideIfDisabled
            />
          </>
        ) : null}
        {replaceOrDefault(
          themeSwitch,
          <ThemeToggle className='max-lg:hidden' mode={themeSwitch?.mode} />
        )}

        {/* Sign In Button or User Menu */}
        {isAuthenticated && session?.user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant='ghost' className='relative h-9 w-9 rounded-full'>
                <Avatar className='h-9 w-9'>
                  <AvatarImage
                    src={session.user.image ?? ''}
                    alt={session.user.name ?? 'User'}
                  />
                  <AvatarFallback className='bg-violet-50 text-violet-600 dark:bg-violet-900/50 dark:text-violet-300'>
                    {session.user.name?.slice(0, 2).toUpperCase() ?? 'U'}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className='w-56' align='end' forceMount>
              <div className='flex items-center justify-start gap-2 p-2'>
                <div className='flex flex-col space-y-1 leading-none'>
                  <p className='font-medium'>{session.user.name}</p>
                </div>
              </div>
              <DropdownMenuItem asChild>
                <Link
                  href={`/players/${session.user.discord_id}`}
                  className='flex w-full items-center'
                >
                  <User className='mr-2 h-4 w-4' />
                  <span>Profile</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link
                  href={`/stream-card/${session.user.discord_id}`}
                  className='flex w-full items-center'
                  target='_blank'
                >
                  <Tv className='mr-2 h-4 w-4' />
                  <span>Stream Widget</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => signOut()}>
                <LogOut className='mr-2 h-4 w-4' />
                <span>Sign out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button
            variant='outline'
            size='sm'
            className='text-gray-700 hover:bg-violet-50 hover:text-violet-600 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-violet-400'
            onClick={() => signIn('discord')}
          >
            <LogIn className='mr-2 h-4 w-4' />
            Sign In
          </Button>
        )}
      </div>
      <ul className='flex flex-row items-center'>
        {navItems.filter(isSecondary).map((item, i) => (
          <NavbarLinkItem
            key={i}
            item={item}
            className='-me-1.5 max-lg:hidden'
          />
        ))}
        <Menu className='lg:hidden'>
          <MenuTrigger
            aria-label='Toggle Menu'
            enableHover={nav.enableHoverToOpen}
          >
            {/*<ChevronDown className='size-3 transition-transform duration-300 group-data-[state=open]:rotate-180' />*/}
          </MenuTrigger>
          <MenuContent className='sm:flex-row sm:items-center sm:justify-end'>
            {menuItems
              .filter((item) => !isSecondary(item))
              .map((item, i) => (
                <MenuLinkItem key={i} item={item} className='sm:hidden' />
              ))}
            <div className='-ms-1.5 flex flex-row items-center gap-1.5 max-sm:mt-2'>
              {menuItems.filter(isSecondary).map((item, i) => (
                <MenuLinkItem key={i} item={item} className='-me-1.5' />
              ))}
              <div role='separator' className='flex-1' />

              {replaceOrDefault(
                themeSwitch,
                <ThemeToggle mode={themeSwitch?.mode} />
              )}
            </div>
          </MenuContent>
        </Menu>
      </ul>
    </Navbar>
  )
}

function NavbarLinkItem({
  item,
  ...props
}: {
  item: LinkItemType
  className?: string
}) {
  if (item.type === 'custom') return <div {...props}>{item.children}</div>

  if (item.type === 'menu') {
    const children = item.items.map((child, j) => {
      if (child.type === 'custom')
        return <Fragment key={j}>{child.children}</Fragment>

      const {
        banner = child.icon ? (
          <div className='w-fit rounded-md border bg-fd-muted p-1 [&_svg]:size-4'>
            {child.icon}
          </div>
        ) : null,
        ...rest
      } = child.menu ?? {}

      return (
        <NavbarMenuLink key={j} href={child.url} {...rest}>
          {rest.children ?? (
            <>
              {banner}
              <p className='-mb-1 font-medium text-sm'>{child.text}</p>
              {child.description ? (
                <p className='text-[13px] text-fd-muted-foreground'>
                  {child.description}
                </p>
              ) : null}
            </>
          )}
        </NavbarMenuLink>
      )
    })

    return (
      <NavbarMenu>
        <NavbarMenuTrigger {...props}>
          {item.url ? <Link href={item.url}>{item.text}</Link> : item.text}
        </NavbarMenuTrigger>
        <NavbarMenuContent>{children}</NavbarMenuContent>
      </NavbarMenu>
    )
  }

  return (
    <NavbarLink
      {...props}
      item={item}
      variant={item.type}
      aria-label={item.type === 'icon' ? item.label : undefined}
    >
      {item.type === 'icon' ? item.icon : item.text}
    </NavbarLink>
  )
}

function isSecondary(item: LinkItemType): boolean {
  return (
    ('secondary' in item && item.secondary === true) || item.type === 'icon'
  )
}
