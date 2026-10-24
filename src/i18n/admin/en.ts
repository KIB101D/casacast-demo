import type { ChannelType, PropertyStatus, PropertyType, UserRole } from "@/db/schema";

/**
 * Back-office strings, English. The Ukrainian file has the same shape (see `AdminDictionary`).
 * Strings that take values are functions: the dictionaries are plain modules that client and
 * server components both import, so nothing has to be serialised.
 */
export const en = {
  meta: {
    overview: "Overview",
    listings: "Listings",
    newListing: "New listing",
    editListing: "Edit listing",
    enquiries: "Enquiries",
    enquiry: "Enquiry",
    publishing: "Publishing",
    signIn: "Sign in",
  },

  common: {
    retry: "Retry",
    delete: "Delete",
    deleting: "Deleting…",
    saving: "Saving…",
    sending: "Sending…",
    ok: "OK",
    error: "Error",
    somethingWrong: "Something went wrong. Please try again.",
    perMonth: " / month",
  },

  shell: {
    backOffice: "Back office",
    navLabel: "Admin",
    nav: {
      overview: "Overview",
      listings: "Listings",
      enquiries: "Enquiries",
      publishing: "Publishing",
    },
    roles: { admin: "admin", demo: "demo" } satisfies Record<UserRole, string>,
    demoNote:
      "Your own sandbox: up to 10 listings, seen only by you. Agency listings are read-only. Everything is deleted at night.",
    signOut: "Sign out",
    toSite: "Open the website",
    newTab: "(opens in a new tab)",
    language: "Language",
  },

  login: {
    title: "Sign in to the back office",
    tryDemo: "Try the demo",
    demoNote:
      "Your own sandbox, no password. What you create is visible only to you and is deleted every night.",
    demoBusy: "The demo is busy right now. Please try again in an hour.",
    orAdmin: "or sign in as admin",
    email: "Email",
    password: "Password",
    signIn: "Sign in",
    signingIn: "Signing in…",
    invalidEmail: "Enter a valid email.",
    enterPassword: "Enter your password.",
    wrongCredentials: "Wrong email or password.",
  },

  labels: {
    types: {
      flat: "Flat",
      chalet: "Villa / chalet",
      bungalow: "Bungalow",
      country_house: "Country house",
      land: "Land",
      shop: "Commercial",
    } satisfies Record<PropertyType, string>,
    operations: { sale: "For sale", rent: "For rent" },
    statuses: {
      draft: "Draft",
      active: "Active",
      sold: "Sold",
      archived: "Archived",
    } satisfies Record<PropertyStatus, string>,
    channels: {
      site: "Agency website",
      kyero: "Kyero XML feed",
      telegram: "Telegram channel",
      mock_portal: "Partner portal (mock)",
    } satisfies Record<ChannelType, string>,
  },

  dashboard: {
    description: "Listings at a glance.",
    newListing: "New listing",
    active: "Active listings",
    drafts: "Drafts",
    sold: "Sold",
    newEnquiries: "New enquiries",
    failedSyncs: "Failed syncs",
  },

  listings: {
    description: "Every listing the agency publishes, newest changes first.",
    newListing: "New listing",
    deleted: "Listing deleted.",
    demoQuota: (used: number, limit: number, left: number) =>
      `Demo account: ${used} of ${limit} listings used, ${left} left.`,
    emptyTitle: "No listings yet",
    emptyText: "Create the first one to see it here.",
    columns: {
      listing: "Listing",
      type: "Type",
      price: "Price",
      status: "Status",
      updated: "Updated",
    },
    noPhoto: "No photo",
    yours: "yours",
  },

  editor: {
    newDescription:
      "Spanish is required. English and Ukrainian are optional. Photos come next, once the listing is saved.",
    create: "Create listing",
    saveChanges: "Save changes",
    enquiries: (count: number, fresh: number) =>
      `${count} ${count === 1 ? "enquiry" : "enquiries"}${fresh > 0 ? ` (${fresh} new)` : ""}`,
    viewOnSite: "View on site",
    created: "Listing created. Now add some photos.",
    readOnly:
      "This is an agency listing, so the demo account can only view it. Create your own listing to try editing.",
    confirmDelete: "Delete this listing? This can't be undone.",
    listingGone: "This listing no longer exists.",
    demoCantEdit: "This listing belongs to the agency, so the demo account can't change it.",
    demoCantPublish:
      "This listing belongs to the agency, so the demo account can't change where it is published.",
    demoCantPhotos:
      "This listing belongs to the agency, so the demo account can't change its photos.",
    demoDailyLimit: "The demo has had a lot of new listings today. Try again tomorrow.",
    saved: "Saved.",
    needsAttention: "Some fields need attention.",
  },

  form: {
    basics: "Basics",
    location: "Location",
    descriptions: "Descriptions",
    type: "Type",
    operation: "Operation",
    status: "Status",
    statusHint: "Drafts aren't published anywhere.",
    price: "Price, €",
    priceHint: { sale: "The full asking price.", rent: "Per month." },
    bedrooms: "Bedrooms",
    bathrooms: "Bathrooms",
    area: "Built area, m²",
    areaHint: "For land: the plot size.",
    plot: "Plot, m²",
    plotHint: "Optional. Houses with land.",
    town: "Town",
    chooseTown: "Choose a town…",
    otherTown: "Other…",
    townName: "Town name",
    province: "Province",
    latitude: "Latitude",
    longitude: "Longitude",
    coordinatesHint: "Optional. Shows the listing on the map.",
    languages: "Language",
    required: "required",
    hasErrors: "(has errors)",
    title: "Title",
    description: "Description",
  },

  validation: {
    required: {
      price: "Enter the price.",
      bedrooms: "Enter the bedrooms.",
      bathrooms: "Enter the bathrooms.",
      area: "Enter the area.",
    },
    fields: {
      price: "Price",
      bedrooms: "Bedrooms",
      bathrooms: "Bathrooms",
      area: "Area",
      plotArea: "Plot",
      latitude: "Latitude",
      longitude: "Longitude",
    },
    number: (field: string) => `${field} must be a number.`,
    whole: (field: string) => `${field} must be a whole number.`,
    atLeast: (field: string, min: number) => `${field} must be at least ${min}.`,
    atMost: (field: string, max: number) =>
      `${field} can't be more than ${max.toLocaleString("en")}.`,
    between: (field: string, limit: number) => `${field} must be between -${limit} and ${limit}.`,
    chooseType: "Choose a property type.",
    chooseOperation: "Choose sale or rent.",
    chooseStatus: "Choose a status.",
    chooseTown: "Choose the town.",
    enterTown: "Enter the town.",
    townTooLong: "Town name is too long.",
    province: "Enter the province.",
    bothCoordinates: "Fill in both latitude and longitude, or leave both empty.",
    title: (min: number, max: number) => `Title must be ${min}–${max} characters.`,
    description: (min: number, max: number) => `Description must be ${min}–${max} characters.`,
  },

  limits: {
    createProperty: (limit: number) =>
      `The demo account can create up to ${limit} listings. Delete one of yours, or wait for the nightly reset.`,
    photosPerProperty: (limit: number) =>
      `A listing can have up to ${limit} photos. Delete one to add another.`,
  },

  photos: {
    heading: "Photos",
    list: "Listing photos",
    none: "No photos yet.",
    cover: "Cover",
    alt: (n: number, cover: boolean) => `Photo ${n}${cover ? " (cover)" : ""}`,
    moveEarlier: (n: number) => `Move photo ${n} earlier`,
    moveLater: (n: number) => `Move photo ${n} later`,
    makeCover: "Make cover",
    deleteLabel: (n: number) => `Delete photo ${n}`,
    confirmDelete: "Delete this photo?",
    preparing: "Preparing…",
    uploading: "Uploading…",
    dragHere: "Drag photos here, or",
    choose: "Choose photos",
    hint: "JPG, PNG or WebP. Photos are resized to 2000 px before upload. Drag tiles to reorder.",
    full: (max: number) =>
      `This listing has the maximum of ${max} photos. Delete one to add another.`,
    skipped: (max: number, skipped: number) =>
      `Only ${max} photos per listing. ${skipped} file(s) were skipped.`,
    demoDailyLimit:
      "Today's demo photo uploads are used up. Try again tomorrow, or use the photos you already have.",
    orderFailed: "Couldn't save the new order. Please try again.",
    unreadable: "This file can't be read as a photo. Use JPG, PNG or WebP.",
    browserFailed: "Your browser couldn't prepare the photo.",
    noFile: "No photo was sent.",
    uploadFailed: "The upload failed. Please try again.",
    unknown: "Unknown photo.",
    alreadyDeleted: "That photo was already deleted.",
    deleted: "That photo was deleted.",
    invalidOrder: "Invalid photo order.",
    changedElsewhere: "The photos changed in another tab. Showing the latest order.",
    check: {
      empty: "The file is empty.",
      tooLarge: "The photo is too large. The limit is 2.5 MB after compression.",
      unreadable: "This file isn't a photo we can read. Use JPG, PNG or WebP.",
      tooSmall: (width: number, height: number, min: number) =>
        `The photo is too small (${width}×${height}). Use one at least ${min} px on the short side.`,
    },
  },

  panel: {
    heading: "Publishing",
    intro:
      "Pick the channels. Saving the listing syncs it everywhere it's on; marking it sold takes it down everywhere.",
    hints: {
      site: "The agency website's catalogue.",
      kyero: "Kyero XML feed at /feeds/kyero.xml, read by Spanish portals.",
      telegram: "Posts to the agency's Telegram channel when a bot is set up; simulated otherwise.",
      kyeroDemo:
        "Same Kyero XML, in a feed of your own listings; the public feed has only the agency's.",
      telegramDemo: "Demo: the post is simulated; nothing is sent to Telegram.",
      mock_portal: "A simulated portal API: slow, and fails now and then, to show retries.",
    },
    links: { kyero: "Open feed", telegram: "Open post", other: "Open" },
    saveChannels: "Save channels",
    unsaved: "Unsaved channel changes",
    lastSynced: (date: string) => `Last synced ${date}`,
    log: (count: number) => `Sync log (${count})`,
    logEmpty: "Nothing synced yet.",
    columns: {
      when: "When",
      channel: "Channel",
      action: "Action",
      result: "Result",
      details: "Details",
    },
    actions: { publish: "Publish", update: "Update", unpublish: "Remove" },
    attempt: (n: number) => ` · try ${n}`,
    notLive: {
      draft: "This listing is a draft, so it isn't published anywhere yet.",
      archived: "This listing is archived, so it isn't published anywhere.",
      then: "Make it active and the ticked channels below go live.",
    },
    publishNow: "Publish now",
    publishing: "Publishing…",
    state: {
      channelOff: "Channel off",
      off: "Off",
      retryingIn: (seconds: number) => `Retrying in ${seconds} s`,
      retrying: "Retrying…",
      attemptNote: (attempt: number, max: number, error: string | null) =>
        `Attempt ${attempt} of ${max}. Last error: ${error}`,
      syncing: "Syncing…",
      failed: "Failed",
      inFeed: "In the feed",
      published: "Published",
      markedSold: "Marked as sold",
      takenDownSold: "Taken down: sold",
      waiting: "Waiting",
      waitingNote: (status: string) =>
        `Goes live when the listing is active (it is ${status.toLowerCase()} now).`,
      notPublished: "Not published",
    },
  },

  publishingPage: {
    description: "Where listings are published, and every sync attempt.",
    runQueue: "Run queue now",
    how: {
      site: "Our own catalogue, straight from the database.",
      kyero: "Public XML feed; portals fetch it on their own schedule.",
      telegram:
        "Bot API: a post per listing, marked as sold when it sells. Simulated for demo sandboxes.",
      mock_portal: "Simulated partner API with delays and random failures.",
    } satisfies Record<ChannelType, string>,
    off: "Off",
    live: "Live",
    queued: "Queued",
    failed: "Failed",
    openFeed: "Open the feed",
    activity: "Recent activity",
    noActivity: "No syncs yet.",
    listing: "Listing",
  },

  leads: {
    description: "Messages from the site: about a listing, or from the contact page.",
    tabs: { new: "New", in_progress: "In progress", handled: "Handled", all: "All" },
    filterLabel: "Filter enquiries",
    demoNotice:
      "Your sandbox sees enquiries about your own listings and the ones sent from this browser (others hold other visitors' contact details). Send the form on a listing page or the contact page to see it arrive here.",
    oneListing: "About one listing",
    showAll: "show all listings",
    emptyNew: "No new enquiries",
    emptyAny: "No enquiries here",
    emptyText: "They arrive from the enquiry form on listing pages and from the contact page.",
    about: "About",
    general: "General enquiry from the contact page",
    emails: (count: number) => `${count} ${count === 1 ? "email" : "emails"} in the conversation`,
    clientReplied: (date: string) => `Client replied ${date}`,
    status: { new: "New", in_progress: "In progress", handled: "Handled" },
    markHandled: "Mark as handled",
    reopen: "Reopen",
    reply: "Reply",
    notFound: "Enquiry not found.",
  },

  conversation: {
    back: "← All enquiries",
    label: "Conversation",
    fromForm: "From the website form",
    you: "You",
    notes: {
      sending: "Sending…",
      sent: "Sent",
      failed: "Not sent",
      simulated: "Demo: not emailed",
    },
    mailMissing:
      "Email isn't set up, so replies can't be sent yet. Add MAIL_ADDRESS and MAIL_APP_PASSWORD (a Gmail app password) to the environment.",
    setUpEmail: "Set up email to reply from here.",
    replyTo: (email: string) => `Reply to ${email}`,
    placeholder: "Hello, thank you for your message…",
    sendEmail: "Send email",
    sendDemo: "Send (demo)",
    from: (address: string) => `From ${address}. Replies come back here.`,
    demoNote: "Demo: the reply is shown in the conversation, but no email is sent.",
    writeFirst: "Write a message first.",
    tooLong: "Keep it under 5,000 characters.",
    notConfigured: "Email isn't set up: add MAIL_ADDRESS and MAIL_APP_PASSWORD to the environment.",
  },
};

/** The shape every back-office language follows. */
export type AdminDictionary = typeof en;
