// Social platform registry. Pure — what each platform IS to the OS: its
// capabilities, its content constraints, and exactly what credentials are
// needed to connect it. The registry is honest about API reality: platforms
// whose publish APIs need an approved developer app are marked so, and the
// UI shows their connect checklist instead of pretending.

export type SocialPlatform =
  | "facebook"
  | "instagram"
  | "tiktok"
  | "youtube"
  | "linkedin"
  | "x"
  | "threads"
  | "whatsapp";

export interface PlatformSpec {
  platform: SocialPlatform;
  label: string;
  /** Native publishing implemented in the OS today. */
  nativePublish: boolean;
  /** Max caption/body length the validator enforces (chars). */
  maxBodyLength: number;
  /** Whether a post REQUIRES at least one image. */
  requiresMedia: boolean;
  /** Max images per post the adapter supports. */
  maxImages: number;
  /** Whether a plain link is allowed in the body/action. */
  supportsLink: boolean;
  /** What the owner must supply to connect — shown as the connect checklist. */
  connectRequirements: string[];
}

export const PLATFORMS: Record<SocialPlatform, PlatformSpec> = {
  facebook: {
    platform: "facebook",
    label: "Facebook Page",
    nativePublish: true,
    maxBodyLength: 5000,
    requiresMedia: false,
    maxImages: 10,
    supportsLink: true,
    connectRequirements: [
      "Facebook Page ID",
      "Long-lived Page access token (pages_manage_posts + pages_read_engagement)",
    ],
  },
  instagram: {
    platform: "instagram",
    label: "Instagram Business",
    nativePublish: true,
    maxBodyLength: 2200,
    requiresMedia: true, // IG has no text-only feed posts
    maxImages: 10,
    supportsLink: false, // links don't hyperlink in captions
    connectRequirements: [
      "Instagram Business account ID (linked to the Facebook Page)",
      "Long-lived token with instagram_basic + instagram_content_publish",
      "Images must be publicly reachable URLs at publish time (the OS signs storage URLs)",
    ],
  },
  tiktok: {
    platform: "tiktok",
    label: "TikTok",
    nativePublish: false,
    maxBodyLength: 2200,
    requiresMedia: true,
    maxImages: 35,
    supportsLink: false,
    connectRequirements: [
      "TikTok for Developers app with Content Posting API approval",
      "Access token via TikTok OAuth (video.publish scope)",
    ],
  },
  youtube: {
    platform: "youtube",
    label: "YouTube",
    nativePublish: false,
    maxBodyLength: 5000,
    requiresMedia: true,
    maxImages: 1,
    supportsLink: true,
    connectRequirements: [
      "Google Cloud project with YouTube Data API v3 enabled",
      "OAuth refresh token for the channel (youtube.upload scope)",
    ],
  },
  linkedin: {
    platform: "linkedin",
    label: "LinkedIn",
    nativePublish: false,
    maxBodyLength: 3000,
    requiresMedia: false,
    maxImages: 9,
    supportsLink: true,
    connectRequirements: [
      "LinkedIn developer app with the Community Management (w_organization_social) product",
      "Organization URN + member/organization access token",
    ],
  },
  x: {
    platform: "x",
    label: "X (Twitter)",
    nativePublish: false,
    maxBodyLength: 280,
    requiresMedia: false,
    maxImages: 4,
    supportsLink: true,
    connectRequirements: [
      "X developer account (paid API tier for posting)",
      "OAuth 2.0 user token with tweet.write + media.write",
    ],
  },
  threads: {
    platform: "threads",
    label: "Threads",
    nativePublish: false,
    maxBodyLength: 500,
    requiresMedia: false,
    maxImages: 10,
    supportsLink: true,
    connectRequirements: [
      "Threads API access via the Meta app (threads_basic + threads_content_publish)",
      "Threads user access token",
    ],
  },
  whatsapp: {
    platform: "whatsapp",
    label: "WhatsApp Business",
    nativePublish: false,
    maxBodyLength: 4096,
    requiresMedia: false,
    maxImages: 1,
    supportsLink: true,
    connectRequirements: [
      "WhatsApp Business Platform (Cloud API) phone number ID",
      "Permanent system-user token (whatsapp_business_messaging)",
      "Note: WhatsApp is 1:1/broadcast messaging, not feed publishing — connected here for status + future intake, not for posts",
    ],
  },
};

export const ALL_PLATFORMS: SocialPlatform[] = Object.keys(PLATFORMS) as SocialPlatform[];
