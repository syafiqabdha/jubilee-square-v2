-- ============================================================================
-- Jubilee Square v2: Initial Database Schema & Seed Data
-- Database: PostgreSQL 16
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ----------------------------------------------------------------------------
-- 1. Categories Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug VARCHAR(64) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    short_code VARCHAR(20) NOT NULL,
    description TEXT,
    icon VARCHAR(64),
    accent_color VARCHAR(32) DEFAULT '#3B82F6',
    display_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 2. Tenants Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    slug VARCHAR(120) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    floor_level VARCHAR(10) NOT NULL, -- 'L1', 'L2', 'L3', 'L4', 'B1'
    unit_number VARCHAR(50) NOT NULL,
    summary VARCHAR(300) NOT NULL,
    description TEXT NOT NULL,
    phone VARCHAR(50),
    whatsapp VARCHAR(50),
    email VARCHAR(120),
    website VARCHAR(255),
    logo_url VARCHAR(500),
    hero_image_url VARCHAR(500),
    gallery JSONB DEFAULT '[]'::jsonb,
    social_links JSONB DEFAULT '{}'::jsonb, -- e.g. {"facebook": "...", "instagram": "..."}
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    metadata JSONB DEFAULT '{}'::jsonb,     -- Category-specific attributes
    is_active BOOLEAN DEFAULT TRUE,
    is_featured BOOLEAN DEFAULT FALSE,
    display_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 3. Operating Hours Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS operating_hours (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    day_name VARCHAR(20) NOT NULL,
    open_time TIME,
    close_time TIME,
    is_closed BOOLEAN DEFAULT FALSE,
    special_notes VARCHAR(200),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_tenant_day UNIQUE (tenant_id, day_of_week)
);

-- ----------------------------------------------------------------------------
-- 4. Amenities Table & Tenant Amenities (M2M)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS amenities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    icon VARCHAR(64) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tenant_amenities (
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    amenity_id UUID NOT NULL REFERENCES amenities(id) ON DELETE CASCADE,
    PRIMARY KEY (tenant_id, amenity_id)
);

-- ----------------------------------------------------------------------------
-- 5. Promotions Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS promotions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
    title VARCHAR(200) NOT NULL,
    slug VARCHAR(200) UNIQUE NOT NULL,
    summary VARCHAR(300),
    description TEXT,
    banner_url VARCHAR(500) NOT NULL,
    badge_text VARCHAR(50) DEFAULT 'PROMO',
    terms_conditions TEXT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    is_featured BOOLEAN DEFAULT FALSE,
    display_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 6. Digital Signage Slides Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS signage_slides (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(200) NOT NULL,
    slide_type VARCHAR(50) NOT NULL DEFAULT 'image', -- 'image', 'video', 'tenant_spotlight', 'html'
    media_url VARCHAR(500) NOT NULL,
    duration_seconds INT DEFAULT 10,
    target_locations TEXT[] DEFAULT ARRAY['all']::TEXT[], -- 'all', 'L1_lift', 'L1_counter', 'L2_lift', 'L2_escalator', 'L3_lift', 'L3_ceiling', 'L4_lift'
    tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
    headline VARCHAR(255),
    subheadline VARCHAR(255),
    start_date TIMESTAMPTZ DEFAULT NOW(),
    end_date TIMESTAMPTZ DEFAULT NOW() + INTERVAL '1 year',
    is_active BOOLEAN DEFAULT TRUE,
    priority INT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 7. Performance & Full-Text Search Indexes
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_tenants_category ON tenants(category_id);
CREATE INDEX IF NOT EXISTS idx_tenants_floor ON tenants(floor_level);
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_active ON tenants(is_active);
CREATE INDEX IF NOT EXISTS idx_operating_hours_tenant ON operating_hours(tenant_id);
CREATE INDEX IF NOT EXISTS idx_promotions_tenant ON promotions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_promotions_dates ON promotions(start_date, end_date, is_active);
CREATE INDEX IF NOT EXISTS idx_signage_active ON signage_slides(is_active, priority);

-- Trigram Indexes for Auto-complete & Fuzzy Search
CREATE INDEX IF NOT EXISTS idx_tenants_name_trgm ON tenants USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_tenants_unit_trgm ON tenants USING gin (unit_number gin_trgm_ops);

-- Full-Text Search Vector Index
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS search_vector tsvector
    GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(unit_number, '')), 'B') ||
        setweight(to_tsvector('english', coalesce(summary, '')), 'C') ||
        setweight(to_tsvector('english', coalesce(description, '')), 'D')
    ) STORED;

CREATE INDEX IF NOT EXISTS idx_tenants_search_vector ON tenants USING gin(search_vector);

-- ----------------------------------------------------------------------------
-- 8. Convenience Views
-- ----------------------------------------------------------------------------

-- View: v_active_tenants
CREATE OR REPLACE VIEW v_active_tenants AS
SELECT 
    t.id,
    t.slug,
    t.name,
    t.floor_level,
    t.unit_number,
    t.summary,
    t.description,
    t.phone,
    t.whatsapp,
    t.email,
    t.website,
    t.logo_url,
    t.hero_image_url,
    t.gallery,
    t.social_links,
    t.tags,
    t.metadata,
    t.is_featured,
    t.display_order,
    c.id AS category_id,
    c.slug AS category_slug,
    c.name AS category_name,
    c.accent_color AS category_color,
    c.icon AS category_icon,
    COALESCE(
        jsonb_agg(
            DISTINCT jsonb_build_object(
                'code', a.code,
                'name', a.name,
                'icon', a.icon
            )
        ) FILTER (WHERE a.id IS NOT NULL), '[]'::jsonb
    ) AS amenities
FROM tenants t
JOIN categories c ON t.category_id = c.id
LEFT JOIN tenant_amenities ta ON t.id = ta.tenant_id
LEFT JOIN amenities a ON ta.amenity_id = a.id
WHERE t.is_active = TRUE
GROUP BY t.id, c.id;

-- View: v_signage_directory (Optimized for Wayfinding Digital Kiosks)
CREATE OR REPLACE VIEW v_signage_directory AS
SELECT 
    t.floor_level,
    t.unit_number,
    t.name AS tenant_name,
    t.slug AS tenant_slug,
    c.name AS category_name,
    c.slug AS category_slug,
    c.icon AS category_icon,
    t.summary,
    t.logo_url,
    t.phone
FROM tenants t
JOIN categories c ON t.category_id = c.id
WHERE t.is_active = TRUE
ORDER BY 
    CASE t.floor_level
        WHEN 'L1' THEN 1
        WHEN 'L2' THEN 2
        WHEN 'L3' THEN 3
        WHEN 'L4' THEN 4
        ELSE 5
    END,
    t.unit_number ASC;

-- ----------------------------------------------------------------------------
-- 9. Seed Data Insertion
-- ----------------------------------------------------------------------------

-- Insert Categories
INSERT INTO categories (id, slug, name, short_code, description, icon, accent_color, display_order)
VALUES
    ('c0000000-0000-0000-0000-000000000001', 'dine', 'Dine', 'FNB', 'Food, drinks, desserts, fast casual, and family dining concepts', 'utensils', '#EF4444', 1),
    ('c0000000-0000-0000-0000-000000000002', 'learn', 'Learn', 'EDU', 'Enrichment centres, language schools, music, and martial arts academies', 'graduation-cap', '#3B82F6', 2),
    ('c0000000-0000-0000-0000-000000000003', 'relax', 'Relax', 'WLN', 'Hair styling, aesthetics, facial care, and foot reflexology wellness', 'sparkles', '#EC4899', 3),
    ('c0000000-0000-0000-0000-000000000004', 'shop', 'Shop', 'RET', 'Specialty retail, eyecare optometrists, and traditional bridal necessities', 'shopping-bag', '#F59E0B', 4),
    ('c0000000-0000-0000-0000-000000000005', 'services', 'Services', 'SVC', 'Healthcare, traditional Chinese medicine clinics, and community services', 'heart-pulse', '#10B981', 5)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    accent_color = EXCLUDED.accent_color;

-- Insert Amenities
INSERT INTO amenities (id, code, name, icon, description)
VALUES
    ('a0000000-0000-0000-0000-000000000001', 'wheelchair', 'Wheelchair Accessible', 'wheelchair', 'Full step-free entrance and wide aisles'),
    ('a0000000-0000-0000-0000-000000000002', 'halal', 'Halal Certified', 'check-circle', 'MUIS Halal Certified food establishment'),
    ('a0000000-0000-0000-0000-000000000003', 'wifi', 'Free Wi-Fi', 'wifi', 'High-speed guest internet connection available'),
    ('a0000000-0000-0000-0000-000000000004', 'child_friendly', 'Child Friendly', 'baby', 'Children high chairs, child-safe facilities'),
    ('a0000000-0000-0000-0000-000000000005', 'credit_card', 'Contactless Payment', 'credit-card', 'Accepts PayNow, Nets, Visa, Mastercard, GrabPay'),
    ('a0000000-0000-0000-0000-000000000006', 'aircon', 'Air Conditioned', 'snowflake', 'Fully air-conditioned indoor premises')
ON CONFLICT (code) DO NOTHING;

-- Insert 23 Tenants
INSERT INTO tenants (id, category_id, slug, name, floor_level, unit_number, summary, description, phone, whatsapp, email, website, logo_url, hero_image_url, tags, metadata, is_featured, display_order)
VALUES
    -- DINE (6 Outlets)
    ('t0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'bantianyao-grilled-fish', 'BANTIANYAO GRILLED FISH', 'L2', '#02-01/02', 'Renowned Chinese catering brand famous for rattan pepper grilled fish and over 1,500 outlets across Asia.', 'Bantianyao Grilled Fish brings authentic Sichuan flavors to Ang Mo Kio. Specializing in fresh whole fish simmered in rich signature broths including rattan pepper, spicy mala, fresh garlic, and tomato broth. Includes free-flow rice, drinks, and ice cream counter.', '+65 6451 2388', '+65 9123 4567', 'amk@bantianyao.sg', 'https://bantianyao.sg', '/images/tenants/bantianyao-logo.png', '/images/tenants/bantianyao-hero.jpg', ARRAY['grilled fish', 'sichuan', 'mala', 'family dining', 'chinese'], '{"cuisine": "Sichuan / Chinese", "price_range": "$$", "seating_capacity": 90, "halal": false}'::jsonb, TRUE, 1),
    ('t0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'jolly-desserts', 'Jolly Desserts', 'L1', '#01-11', 'Traditional Chinese tong shui, shaved ice desserts, and artisanal sweet snacks.', 'Jolly Desserts offers comforting traditional sweet soups and modern shaved ice creations. Popular favorites include Mango Pomelo Sago, Peach Gum Herbal Broth, Tang Yuan ginger soup, and Durian shaved snow ice.', '+65 6452 8812', '+65 9876 5432', 'hello@jollydesserts.com', 'https://jollydesserts.com', '/images/tenants/jolly-logo.png', '/images/tenants/jolly-hero.jpg', ARRAY['dessert', 'tong shui', 'shaved ice', 'mango pomelo', 'sweets'], '{"cuisine": "Desserts", "price_range": "$", "seating_capacity": 30, "takeaway": true}'::jsonb, FALSE, 2),
    ('t0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000001', 'max-see-veggie-house', 'Max-See & Veggie House', 'L1', '#01-08', 'Plant-based delicacies, fresh fruit teas, bubble tea, and vegetarian dining.', 'Combining a specialized vegetarian cafe with refreshing handcrafted teas. Offers plant-based bento boxes, vegetarian laksa, herbal noodle bowls alongside fresh fruit teas, cheese foam teas, and brown sugar boba.', '+65 6453 9921', '+65 9234 5678', 'enquiry@maxsee.sg', 'https://maxsee.sg', '/images/tenants/maxsee-logo.png', '/images/tenants/maxsee-hero.jpg', ARRAY['vegetarian', 'bubble tea', 'fruit tea', 'plant based', 'cafe'], '{"cuisine": "Vegetarian & Beverages", "price_range": "$", "seating_capacity": 25, "takeaway": true}'::jsonb, FALSE, 3),
    ('t0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000001', 'siam-square-mookata', 'Siam Square Mookata', 'L2', '#02-03', 'Popular casual Thai mookata BBQ and steamboat with authentic chili dips.', 'Siam Square Mookata serves sizzling Thai street BBQ and hotpot. Freshly marinated meats, seafood, cheese dip, and their signature 3 levels of chili sauce. Great for friends and family gatherings.', '+65 6454 1109', '+65 9345 6789', 'contact@siamsquaremookata.com.sg', 'https://siamsquaremookata.com.sg', '/images/tenants/siamsquare-logo.png', '/images/tenants/siamsquare-hero.jpg', ARRAY['thai', 'mookata', 'bbq', 'hotpot', 'buffet'], '{"cuisine": "Thai BBQ", "price_range": "$$", "seating_capacity": 80, "halal": false}'::jsonb, TRUE, 4),
    ('t0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000001', 'subway', 'Subway', 'L1', '#01-05', 'Freshly made submarine sandwiches, wraps, salads, and cookies.', 'The world-famous fast casual brand serving wholesome customized submarine sandwiches, wraps, and salads made fresh in front of you. Choose your fresh baked bread, crisp vegetables, protein, and savory sauces.', '+65 6455 7733', '+65 9456 7890', 'jubilee@subway.com.sg', 'https://subway.com.sg', '/images/tenants/subway-logo.png', '/images/tenants/subway-hero.jpg', ARRAY['sandwiches', 'halal', 'fast food', 'healthy', 'takeaway'], '{"cuisine": "Fast Casual", "price_range": "$", "seating_capacity": 40, "halal": true}'::jsonb, FALSE, 5),
    ('t0000000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-000000000001', 'ya-kun-kaya-toast', 'Ya Kun Kaya Toast', 'L1', '#01-01/02', 'Traditional Singapore kaya toast, soft-boiled eggs, and aromatic Nanyang kopi/teh.', 'Singapore heritage coffeehouse icon since 1944. Crispy grilled toast lathered with aromatic kaya and butter, runny soft-boiled eggs with dark soya sauce and pepper, paired with robust freshly brewed Nanyang kopi.', '+65 6456 0088', '+65 9567 8901', 'customerservice@yakun.com', 'https://yakun.com', '/images/tenants/yakun-logo.png', '/images/tenants/yakun-hero.jpg', ARRAY['kaya toast', 'kopi', 'heritage', 'breakfast', 'singaporean'], '{"cuisine": "Singapore Traditional Coffeehouse", "price_range": "$", "seating_capacity": 55, "halal": false}'::jsonb, TRUE, 6),

    -- LEARN (9 Outlets)
    ('t0000000-0000-0000-0000-000000000007', 'c0000000-0000-0000-0000-000000000002', 'agrader-learning-centre', 'AGrader Learning Centre', 'L3', '#03-01/02', 'Primary & Secondary tuition programmes with comprehensive worksheets and diagnostic assessments.', 'Award-winning academic tuition centre in Singapore for Primary and Secondary English, Math, Science, and Creative Writing. Includes proprietary EverLoop Revision system and homework clinic assistance.', '+65 6457 1234', '+65 9678 9012', 'amk@agrader.sg', 'https://agrader.sg', '/images/tenants/agrader-logo.png', '/images/tenants/agrader-hero.jpg', ARRAY['tuition', 'primary', 'secondary', 'math', 'science', 'english'], '{"levels": ["Primary 1-6", "Secondary 1-4"], "subjects": ["English", "Math", "Science", "Creative Writing"]}'::jsonb, TRUE, 7),
    ('t0000000-0000-0000-0000-000000000008', 'c0000000-0000-0000-0000-000000000002', 'artlette', 'Artlette', 'L3', '#03-05', 'Creative art studio offering drawing, painting, acrylic, and portfolio preparation for kids and teens.', 'Artlette creates an imaginative art space for children and teens to explore watercolors, acrylic canvas painting, clay modeling, digital illustration, and DSA art portfolio guidance.', '+65 6458 5678', '+65 9789 0123', 'hello@artlette.sg', 'https://artlette.sg', '/images/tenants/artlette-logo.png', '/images/tenants/artlette-hero.jpg', ARRAY['art', 'drawing', 'painting', 'acrylic', 'dsa portfolio', 'kids'], '{"age_group": "Ages 4 to 18", "programmes": ["Children Art", "Teens Art Studio", "DSA Art Portfolio"]}'::jsonb, FALSE, 8),
    ('t0000000-0000-0000-0000-000000000009', 'c0000000-0000-0000-0000-000000000002', 'guitar-emerge-music-school', 'Guitar Emerge Music School', 'L4', '#04-03', 'Acoustic, electric, and bass guitar lessons tailored for leisure and graded examinations.', 'Specialized guitar boutique school offering individual and small-group coaching in Acoustic Guitar, Electric Guitar, Classical, Bass, and Ukulele for students of all ages.', '+65 6459 9012', '+65 9890 1234', 'info@guitaremerge.com', 'https://guitaremerge.com', '/images/tenants/guitaremerge-logo.png', '/images/tenants/guitaremerge-hero.jpg', ARRAY['guitar', 'music school', 'acoustic', 'electric guitar', 'ukulele', 'graded exams'], '{"instruments": ["Acoustic Guitar", "Electric Guitar", "Bass", "Ukulele"], "certification": "Rockschool / Trinity"}'::jsonb, FALSE, 9),
    ('t0000000-0000-0000-0000-000000000010', 'c0000000-0000-0000-0000-000000000002', 'jeong-in-taekwondo', 'Jeong-In Taekwondo Education Centre', 'L3', '#03-08/09', 'Authentic Korean Taekwondo academy focusing on discipline, poomsae, sparring, and belt advancement.', 'Led by Kukkiwon-certified Korean Grandmasters and coaches. Teaches traditional Korean martial arts values, self-defense, Olympic sparring, and character development for tots, children, and adults.', '+65 6460 3456', '+65 9901 2345', 'amk@jeongintaekwondo.com', 'https://jeongintaekwondo.com', '/images/tenants/jeongin-logo.png', '/images/tenants/jeongin-hero.jpg', ARRAY['taekwondo', 'martial arts', 'korean', 'self defense', 'character building'], '{"certification": "Kukkiwon / Singapore Taekwondo Federation", "age_group": "Ages 3.5 and above"}'::jsonb, TRUE, 10),
    ('t0000000-0000-0000-0000-000000000011', 'c0000000-0000-0000-0000-000000000002', 'lcentral', 'LCentral', 'L3', '#03-06/07', 'Structured early-reading, phonics, grammar, speech, and PSLE English mastery courses.', 'Premier English language enrichment specialist in Singapore. Offers phonics foundation, reading fluency, advanced grammar, primary writing composition, and speech communication.', '+65 6461 7890', '+65 9012 3456', 'amk@lcentral.net', 'https://lcentral.net', '/images/tenants/lcentral-logo.png', '/images/tenants/lcentral-hero.jpg', ARRAY['english', 'phonics', 'reading', 'psle english', 'literacy'], '{"programmes": ["LaunchPad (Phonics)", "LiftOff (Reading)", "Success (Primary English)"]}'::jsonb, FALSE, 11),
    ('t0000000-0000-0000-0000-000000000012', 'c0000000-0000-0000-0000-000000000002', 'learning-kidz', 'Learning Kidz', 'L4', '#04-01/02', 'Holistic early childhood curriculum focusing on cognitive and motor skill development.', 'Warm, nurturing early learning preschool environment encouraging inquiry-based learning, social socialization, bilingual literacy, music movement, and STEM discovery for infants and preschoolers.', '+65 6462 2345', '+65 9123 7890', 'enquiry@learningkidz.com.sg', 'https://learningkidz.com.sg', '/images/tenants/learningkidz-logo.png', '/images/tenants/learningkidz-hero.jpg', ARRAY['preschool', 'childcare', 'early learning', 'kindergarten', 'toddler'], '{"levels": ["Playgroup", "Nursery 1-2", "Kindergarten 1-2"], "ecda_licensed": true}'::jsonb, FALSE, 12),
    ('t0000000-0000-0000-0000-000000000013', 'c0000000-0000-0000-0000-000000000002', 'mcube-learning-centre', 'Mcube Learning Centre', 'L3', '#03-03/04', 'Olympiad math, heuristic problem solving, and secondary math coaching.', 'Math specialists dedicated to transforming how students understand and conquer math. Teaches model-drawing heuristics, algebra manipulation, exam problem-solving speed, and Olympiad competition prep.', '+65 6463 6789', '+65 9234 8901', 'info@mcubelearning.sg', 'https://mcubelearning.sg', '/images/tenants/mcube-logo.png', '/images/tenants/mcube-hero.jpg', ARRAY['math', 'olympiad math', 'heuristics', 'psle math', 'o level math'], '{"subjects": ["Primary Heuristics Math", "Secondary E-Math / A-Math", "Math Olympiad"]}'::jsonb, FALSE, 13),
    ('t0000000-0000-0000-0000-000000000014', 'c0000000-0000-0000-0000-000000000002', 'my-drum-school', 'My Drum School', 'L4', '#04-04/05', 'Specialized drum education with modern facilities, certified instructors, and customized syllabi.', 'Singapore premier drum-only music academy. Equipped with state-of-the-art acoustic drum studios, customized digital tracking syllabus, Rockschool examination certification, and live performance opportunities.', '+65 6464 0123', '+65 9345 9012', 'amk@mydrumschool.com', 'https://mydrumschool.com', '/images/tenants/mydrumschool-logo.png', '/images/tenants/mydrumschool-hero.jpg', ARRAY['drums', 'percussion', 'music school', 'rockschool', 'drum lessons'], '{"facility": "Acoustic Soundproof Studios", "curriculum": "MDS Proprietary Drum Syllabus", "exam_board": "Rockschool UK"}'::jsonb, TRUE, 14),
    ('t0000000-0000-0000-0000-000000000015', 'c0000000-0000-0000-0000-000000000002', 'wang-learning-centre', 'Wang Learning Centre', 'L3', '#03-10/11', 'High-impact Chinese language tuition, creative writing, and oral exam preparation.', 'One of Singapore most respected Chinese language tuition brands. Focuses on Primary and Secondary Chinese composition writing, comprehension skills, Hanyu Pinyin mastery, and oral examination confidence.', '+65 6465 4567', '+65 9456 0123', 'amk@wang.com.sg', 'https://wang.com.sg', '/images/tenants/wang-logo.png', '/images/tenants/wang-hero.jpg', ARRAY['chinese tuition', 'composition', 'hanyu pinyin', 'psle chinese', 'o level higher chinese'], '{"subjects": ["Primary Chinese", "Higher Chinese", "Secondary Chinese", "Oral & Composition"]}'::jsonb, TRUE, 15),

    -- RELAX (5 Outlets)
    ('t0000000-0000-0000-0000-000000000016', 'c0000000-0000-0000-0000-000000000003', '7-studio-hair-salon', '7 Studio Hair Salon', 'L2', '#02-06', 'Professional haircuts, coloring, perm treatments, and scalp therapy.', 'Full-service hair design salon specializing in modern Korean perms, Japanese rebonding, balayage hair coloring, and detoxifying scalp treatments using premium haircare formulations.', '+65 6466 8901', '+65 9567 1234', 'booking@7studio.sg', 'https://7studio.sg', '/images/tenants/7studio-logo.png', '/images/tenants/7studio-hero.jpg', ARRAY['hair salon', 'korean perm', 'haircut', 'coloring', 'scalp treatment'], '{"services": ["Cut & Blow", "Korean C-Curl Perm", "Scalp Therapy", "Balayage Color"]}'::jsonb, FALSE, 16),
    ('t0000000-0000-0000-0000-000000000017', 'c0000000-0000-0000-0000-000000000003', 'ashi-foot-reflexology', 'Ashi Foot Reflexology', 'L2', '#02-08', 'Traditional foot reflexology, acupressure body massage, and tension relief therapy.', 'Serene wellness sanctuary providing authentic pressure-point foot reflexology, back & shoulder pain relief massage, and herbal foot soaks to rejuvenate tired bodies and promote blood circulation.', '+65 6467 2345', '+65 9678 2345', 'info@ashireflexology.com', 'https://ashireflexology.com', '/images/tenants/ashi-logo.png', '/images/tenants/ashi-hero.jpg', ARRAY['massage', 'foot reflexology', 'wellness', 'acupressure', 'relaxation'], '{"services": ["Foot Reflexology (40/60 min)", "Full Body Acupressure", "Shoulder & Neck Relief"]}'::jsonb, TRUE, 17),
    ('t0000000-0000-0000-0000-000000000018', 'c0000000-0000-0000-0000-000000000003', 'glow-haven', 'Glow Haven', 'L2', '#02-09', 'Personalized facial treatments, anti-aging therapies, and deep-cleansing skin regimens.', 'Boutique facial and skincare studio providing bespoke customized facial therapies, extraction treatments, collagen plumping, and LED light skin rejuvenation in private, tranquil suites.', '+65 6468 6789', '+65 9789 3456', 'amk@glowhaven.sg', 'https://glowhaven.sg', '/images/tenants/glowhaven-logo.png', '/images/tenants/glowhaven-hero.jpg', ARRAY['facial', 'skincare', 'anti aging', 'extraction', 'beauty'], '{"services": ["Deep Pore Cleansing", "Hydra Glow Facial", "Oxygen Infusion"]}'::jsonb, FALSE, 18),
    ('t0000000-0000-0000-0000-000000000019', 'c0000000-0000-0000-0000-000000000003', 'skin-labo', 'Skin Labo', 'L2', '#02-04/05', 'Advanced non-invasive skin treatments and aesthetic beauty care.', 'Medical-grade aesthetic skincare centre offering HIFU lifting, radio-frequency skin tightening, pigment laser therapy, and soothing botanical skin treatments.', '+65 6469 0123', '+65 9890 4567', 'enquiry@skinlabo.com.sg', 'https://skinlabo.com.sg', '/images/tenants/skinlabo-logo.png', '/images/tenants/skinlabo-hero.jpg', ARRAY['aesthetics', 'hifu', 'skin tightening', 'pigmentation', 'beauty care'], '{"services": ["HIFU Face Lift", "Pico Laser Glow", "RF Skin Tightening"]}'::jsonb, FALSE, 19),
    ('t0000000-0000-0000-0000-000000000020', 'c0000000-0000-0000-0000-000000000003', 'soul-scissors-studio', 'Soul Scissors Studio', 'L2', '#02-07', 'Trend haircuts, creative dye work, and modern hair styling.', 'Trendy hair salon known for creative color transformations, fashion hair highlights, precision fade cuts, and nourishing Olaplex hair bond repair treatments.', '+65 6470 4567', '+65 9901 5678', 'contact@soulscissors.com', 'https://soulscissors.com', '/images/tenants/soulscissors-logo.png', '/images/tenants/soulscissors-hero.jpg', ARRAY['hair salon', 'creative color', 'fade cut', 'olaplex', 'styling'], '{"services": ["Precision Cuts", "Ombre / Highlights", "Olaplex Treatment"]}'::jsonb, FALSE, 20),

    -- SHOP (2 Outlets)
    ('t0000000-0000-0000-0000-000000000021', 'c0000000-0000-0000-0000-000000000004', 'eyechamp-optometrists', 'Eyechamp Optometrists', 'L1', '#01-06/07', 'Comprehensive eye examinations, designer frames, prescription lenses, and contact lenses.', 'Full-scope optical practice staffed by certified optometrists. Offers computerized vision testing, orthokeratology, myopia control lenses, designer sunglasses, and premium spectacle frames.', '+65 6471 8901', '+65 9012 6789', 'amk@eyechamp.com.sg', 'https://eyechamp.com.sg', '/images/tenants/eyechamp-logo.png', '/images/tenants/eyechamp-hero.jpg', ARRAY['optical', 'optometry', 'glasses', 'spectacles', 'contact lenses', 'myopia control'], '{"brands": ["Ray-Ban", "Gucci", "Hoya", "Essilor", "Acuvue"], "services": ["Eye Health Check", "Myopia Control Clinic"]}'::jsonb, TRUE, 21),
    ('t0000000-0000-0000-0000-000000000022', 'c0000000-0000-0000-0000-000000000004', 'the-chinese-wedding-shop', 'The Chinese Wedding Shop', 'L1', '#01-09/10', 'Chinese betrothal sets (Guo Da Li), dowry packages, wedding decorations, and traditional bridal necessities.', 'Singapore leading specialty bridal customs purveyor. Dedicated to preserving Chinese wedding heritage with curated Guo Da Li gift baskets, traditional bedding, tea ceremony tea sets, and dialect wedding consultation.', '+65 6472 2345', '+65 9123 0123', 'amk@thechineseweddingshop.com.sg', 'https://thechineseweddingshop.com.sg', '/images/tenants/chinesewedding-logo.png', '/images/tenants/chinesewedding-hero.jpg', ARRAY['chinese wedding', 'guo da li', 'betrothal', 'dowry', 'traditional bridal'], '{"specialties": ["Dialect Custom Consultation (Hokkien, Teochew, Cantonese, Hakka)", "Guo Da Li Hampers", "Tea Ceremony Sets"]}'::jsonb, FALSE, 22),

    -- SERVICES (1 Outlet)
    ('t0000000-0000-0000-0000-000000000023', 'c0000000-0000-0000-0000-000000000005', 'tianyi-inmed-tcm-clinic', 'Tianyi InMed TCM Clinic', 'L1', '#01-03/04', 'Certified TCM physicians providing acupuncture, cupping, herbal medicine, and pain management therapy.', 'Registered TCM clinic offering holistic clinical diagnoses, painless acupuncture, therapeutic cupping (Ba Guan), Tuina manipulation, and customized herbal granule prescriptions for chronic ailments and wellness.', '+65 6473 6789', '+65 9234 1234', 'clinic@tianyitcm.com.sg', 'https://tianyitcm.com.sg', '/images/tenants/tianyi-logo.png', '/images/tenants/tianyi-hero.jpg', ARRAY['tcm', 'acupuncture', 'cupping', 'herbal medicine', 'tuina', 'healthcare'], '{"certifications": ["TCMPB Registered Physicians", "CHAS Approved"], "services": ["Acupuncture", "Herbal Prescription", "Cupping Therapy", "Tuina"]}'::jsonb, TRUE, 23)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    summary = EXCLUDED.summary,
    description = EXCLUDED.description,
    floor_level = EXCLUDED.floor_level,
    unit_number = EXCLUDED.unit_number;

-- Seed Operating Hours for all 23 tenants (Default Daily 10:00 - 21:30)
INSERT INTO operating_hours (tenant_id, day_of_week, day_name, open_time, close_time, is_closed)
SELECT 
    t.id,
    d.day_num,
    d.day_title,
    '10:00:00'::TIME,
    '21:30:00'::TIME,
    FALSE
FROM tenants t
CROSS JOIN (
    VALUES 
        (0, 'Sunday'),
        (1, 'Monday'),
        (2, 'Tuesday'),
        (3, 'Wednesday'),
        (4, 'Thursday'),
        (5, 'Friday'),
        (6, 'Saturday')
) AS d(day_num, day_title)
ON CONFLICT (tenant_id, day_of_week) DO NOTHING;

-- Map Amenities to Tenants
INSERT INTO tenant_amenities (tenant_id, amenity_id)
SELECT t.id, a.id 
FROM tenants t, amenities a 
WHERE a.code IN ('wheelchair', 'credit_card', 'aircon')
ON CONFLICT DO NOTHING;

-- Special amenity tags
INSERT INTO tenant_amenities (tenant_id, amenity_id)
SELECT t.id, a.id 
FROM tenants t, amenities a 
WHERE t.slug = 'subway' AND a.code = 'halal'
ON CONFLICT DO NOTHING;

INSERT INTO tenant_amenities (tenant_id, amenity_id)
SELECT t.id, a.id 
FROM tenants t, amenities a 
WHERE t.slug IN ('learning-kidz', 'artlette', 'agrader-learning-centre', 'my-drum-school') AND a.code = 'child_friendly'
ON CONFLICT DO NOTHING;

INSERT INTO tenant_amenities (tenant_id, amenity_id)
SELECT t.id, a.id 
FROM tenants t, amenities a 
WHERE t.slug IN ('ya-kun-kaya-toast', 'bantianyao-grilled-fish', 'my-drum-school') AND a.code = 'wifi'
ON CONFLICT DO NOTHING;

-- Seed Sample Promotions
INSERT INTO promotions (id, tenant_id, title, slug, summary, description, banner_url, badge_text, terms_conditions, start_date, end_date, is_active, is_featured, display_order)
VALUES
    ('p0000000-0000-0000-0000-000000000001', 't0000000-0000-0000-0000-000000000001', 'Bantianyao Weekday Lunch Special — 20% Off Whole Fish', 'bantianyao-lunch-special', 'Enjoy 20% off all whole grilled fish flavors between 11:30am and 3:00pm on weekdays.', 'Valid for dine-in only from Monday to Friday. Choice of rattan pepper, fresh tomato, or mala broth.', '/images/promotions/promo-bantianyao.jpg', '20% OFF', 'Valid on weekdays only excluding Public Holidays. Not valid with other bank promos.', '2026-09-01', '2026-10-31', TRUE, TRUE, 1),
    ('p0000000-0000-0000-0000-000000000002', 't0000000-0000-0000-0000-000000000014', 'My Drum School Free 30-Minute Trial Session', 'mds-free-trial', 'Book a complimentary 1-on-1 acoustic drum evaluation and studio tour.', 'Experience hands-on drum coaching with certified music tutors at Level 4.', '/images/promotions/promo-drum.jpg', 'FREE TRIAL', 'Limited to 1 redemption per new student.', '2026-09-01', '2026-12-31', TRUE, TRUE, 2),
    ('p0000000-0000-0000-0000-000000000003', 't0000000-0000-0000-0000-000000000017', 'Ashi Reflexology: 60-min Foot & Shoulder Combo at $58', 'ashi-wellness-combo', 'Relax and relieve weekday fatigue with our signature acupressure package.', 'Includes 40 mins foot reflexology + 20 mins neck & shoulder tension relief massage.', '/images/promotions/promo-ashi.jpg', '$58 ONLY', 'Valid daily before 5:00pm.', '2026-09-01', '2026-11-30', TRUE, FALSE, 3)
ON CONFLICT (slug) DO NOTHING;

-- Seed Digital Signage Slides (7 Physical Displays across Levels 1–4)
INSERT INTO signage_slides (id, title, slide_type, media_url, duration_seconds, target_locations, tenant_id, headline, subheadline, is_active, priority)
VALUES
    ('s0000000-0000-0000-0000-000000000001', 'Welcome to Jubilee Square AMK', 'image', '/images/signage/welcome-banner.jpg', 12, ARRAY['all']::TEXT[], NULL, 'Welcome to Jubilee Square', 'Your Community Dining, Learning & Wellness Destination in AMK', TRUE, 1),
    ('s0000000-0000-0000-0000-000000000002', 'Level 3 & 4 Education Hub Spotlight', 'image', '/images/signage/education-spotlight.jpg', 15, ARRAY['L1_lift', 'L1_counter', 'L3_lift', 'L4_lift']::TEXT[], NULL, 'Explore Top Enrichment Centres on Levels 3 & 4', 'My Drum School • AGrader • LCentral • Jeong-In Taekwondo • Wang Learning', TRUE, 2),
    ('s0000000-0000-0000-0000-000000000003', 'Bantianyao Grilled Fish Featured', 'image', '/images/signage/bantianyao-slide.jpg', 10, ARRAY['L1_counter', 'L2_lift', 'L2_escalator']::TEXT[], 't0000000-0000-0000-0000-000000000001', 'Sizzling Sichuan Flavors on Level 2 (#02-01)', 'Rattan Pepper Grilled Fish & Unlimited Buffet Counter', TRUE, 3),
    ('s0000000-0000-0000-0000-000000000004', 'Level 2 Wellness & Hair Studios', 'image', '/images/signage/wellness-slide.jpg', 10, ARRAY['L2_lift', 'L2_escalator']::TEXT[], NULL, 'Recharge on Level 2', 'Ashi Foot Reflexology • 7 Studio Hair Salon • Skin Labo • Glow Haven', TRUE, 4),
    ('s0000000-0000-0000-0000-000000000005', 'Wayfinding & Interactive Directory Map', 'html', '/signage/wayfinding-kiosk', 20, ARRAY['L1_lift', 'L2_lift', 'L3_lift', 'L4_lift', 'L3_ceiling']::TEXT[], NULL, 'Digital Directory & Floor Wayfinding', 'Touch screen or view full floor layout on your mobile phone', TRUE, 5)
ON CONFLICT (id) DO NOTHING;
