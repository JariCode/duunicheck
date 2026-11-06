export const clerkAppearance = {
  variables: {
    colorPrimary: '#caff45',
    colorText: '#f8f3ff',
    colorTextSecondary: '#c2b1d1',
    colorBackground: '#1b1228',
    colorInputBackground: '#10091b',
    colorInputText: '#f8f3ff',
    colorDanger: '#ff759c',
    colorSuccess: '#caff45',
    colorWarning: '#ffbe48',
    colorNeutral: '#c2b1d1',
    borderRadius: '12px',
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '13px',
  },
  elements: {
    rootBox: 'duuni-clerk-root',
    card: 'duuni-clerk-card',
    headerTitle: 'duuni-clerk-title',
    headerSubtitle: 'duuni-clerk-subtitle',
    formFieldLabel: 'duuni-clerk-label',
    formFieldInput: 'duuni-clerk-input',
    formFieldHintText: 'duuni-clerk-hint',
    formFieldErrorText: 'duuni-clerk-error',
    formButtonPrimary: 'duuni-clerk-primary',
    footerActionText: 'duuni-clerk-footer-text',
    footerActionLink: 'duuni-clerk-link',
    socialButtonsBlockButton: 'duuni-clerk-social',
    dividerLine: 'duuni-clerk-divider',
    dividerText: 'duuni-clerk-divider-text',
    alert: 'duuni-clerk-alert',
    footer: 'duuni-clerk-footer',
    footerAction: 'duuni-clerk-footer-action',
    footerPages: 'duuni-clerk-footer-pages',
    userButtonPopoverRootBox: 'duuni-clerk-popover-root',
    userButtonPopoverCard: 'duuni-clerk-popover',
    userButtonPopoverActionButton: 'duuni-clerk-menu-button',
    userButtonPopoverActionButtonText: 'duuni-clerk-menu-text',
    userButtonPopoverFooter: 'duuni-clerk-popover-footer',
    userProfileRootBox: 'duuni-clerk-profile-root',
    userProfileNavbar: 'duuni-clerk-profile-nav',
    userProfilePage: 'duuni-clerk-profile-page',
    userProfileSection: 'duuni-clerk-profile-section',
    userProfileSectionTitle: 'duuni-clerk-profile-title',
    userProfileSectionSubtitle: 'duuni-clerk-profile-subtitle',
    userProfilePrimaryButton: 'duuni-clerk-primary',
  },
}

const profileThemeVariables = {
  default: {
    colorPrimary: '#caff45',
    colorText: '#f8f3ff',
    colorTextSecondary: '#c2b1d1',
    colorBackground: '#1b1228',
    colorInputBackground: '#10091b',
    colorInputText: '#f8f3ff',
    colorNeutral: '#c2b1d1',
    colorDanger: '#ff759c',
    colorSuccess: '#caff45',
    colorWarning: '#ffbe48',
  },
  dark: {
    colorPrimary: '#64f1cf',
    colorText: '#eaf6fb',
    colorTextSecondary: '#a9c1cb',
    colorBackground: '#081722',
    colorInputBackground: '#060f16',
    colorInputText: '#eaf6fb',
    colorNeutral: '#a9c1cb',
    colorDanger: '#ff789c',
    colorSuccess: '#64f1cf',
    colorWarning: '#ffd27a',
  },
  light: {
    colorPrimary: '#7045be',
    colorText: '#302440',
    colorTextSecondary: '#62556f',
    colorBackground: '#fffaff',
    colorInputBackground: '#ffffff',
    colorInputText: '#302440',
    colorNeutral: '#62556f',
    colorDanger: '#a52d50',
    colorSuccess: '#315d30',
    colorWarning: '#805315',
  },
}

export function clerkProfileAppearance(theme) {
  return {
    ...clerkAppearance,
    variables: { ...clerkAppearance.variables, ...(profileThemeVariables[theme] || profileThemeVariables.default) },
  }
}

export function clerkUserButtonAppearance(theme) {
  const colors = profileThemeVariables[theme] || profileThemeVariables.default
  return {
    ...clerkAppearance,
    variables: {
      ...clerkAppearance.variables,
      ...colors,
      // Clerk intentionally renders custom account-menu links with its
      // secondary/neutral text color. Keep those links as legible as the
      // built-in Manage account and Sign out actions in every app theme.
      colorTextSecondary: colors.colorText,
      colorNeutral: colors.colorText,
    },
  }
}
