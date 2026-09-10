export const operations = {
  searchTours: `query MobileSearchTours($filters: SearchFilters, $locale: String!, $pageSize: Int!) {
    searchTours(filters: $filters, locale: $locale, pageSize: $pageSize) {
      total
      items {
        tourRefId
        slug
        title
        summary
        destinationName
        categoryName
        durationMin
        priceFrom
        currency
        hasAvailabilityNext30Days
      }
    }
  }`,
  searchExperiences: `query MobileSearchExperiences($locale: String!, $pageSize: Int!) {
    searchTours(locale: $locale, pageSize: $pageSize) {
      total
      items {
        tourRefId
        slug
        title
        summary
        destinationName
        providerName
        confirmationType
        durationMin
        priceFrom
        currency
        thumbnailUrl
        hasAvailabilityNext30Days
      }
    }
  }`,
  tour: `query MobileTour($slug: String!, $locale: String!) {
    tour(slug: $slug, locale: $locale) {
      tourRefId
      slug
      title
      summary
      destinationName
      categoryName
      durationMin
      priceFrom
      currency
      hasAvailabilityNext30Days
    }
  }`,
  availability: `query MobileAvailability($tourRefId: ID!, $from: String!, $to: String!) {
    availability(tourRefId: $tourRefId, from: $from, to: $to) {
      date
      timeSlot
      capacity
      reserved
      spotsLeft
      isBlocked
    }
  }`,
  bookingHold: `query MobileBookingHold($code: String!) {
    booking(code: $code, locale: "es") {
      id
      code
      tourRefId
      date
      timeSlot
      participants
      status
      confirmationType
      holdExpiresAt
      priceSnapshot
    }
  }`,
  createBookingHold: `mutation MobileCreateBookingHold($input: CreateBookingInput!) {
    createBookingHold(input: $input) {
      id
      code
      tourRefId
      participants
      status
      confirmationType
      holdExpiresAt
      priceSnapshot
      policySnapshot
    }
  }`,
} as const;
