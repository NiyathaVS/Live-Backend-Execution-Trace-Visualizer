INSERT INTO users (id, display_name) VALUES (1, 'Demo User');
INSERT INTO users (id, display_name) VALUES (2, 'Test User');
INSERT INTO users (id, display_name) VALUES (42, 'Order Customer');

INSERT INTO products (sku, product_name, unit_price, category, express_eligible) VALUES
    ('SKU-001', 'Wireless Headphones', 79.99, 'electronics', TRUE),
    ('SKU-002', 'USB-C Hub', 24.50, 'electronics', TRUE),
    ('SKU-003', 'Mechanical Keyboard', 129.00, 'electronics', FALSE),
    ('SKU-004', 'Monitor Stand', 45.00, 'electronics', TRUE),
    ('SKU-005', 'Webcam HD', 59.99, 'electronics', TRUE);

INSERT INTO inventory (sku, quantity) VALUES
    ('SKU-001', 120),
    ('SKU-002', 85),
    ('SKU-003', 40),
    ('SKU-004', 200),
    ('SKU-005', 65);

INSERT INTO orders (order_id, customer_id, status, street, city, state, postal_code, country) VALUES
    (1001, 42, 'PENDING', '742 Evergreen Terrace', 'Springfield', 'IL', '62704', 'US'),
    (1002, 42, 'PENDING', '1600 Pennsylvania Ave', 'Washington', 'DC', '20500', 'US'),
    (1003, 42, 'PENDING', '1 Infinite Loop', 'Cupertino', 'CA', '95014', 'US');

INSERT INTO order_line_items (order_id, sku, product_name, quantity, unit_price) VALUES
    (1001, 'SKU-001', 'Wireless Headphones', 1, 79.99),
    (1001, 'SKU-002', 'USB-C Hub', 2, 24.50),
    (1001, 'SKU-003', 'Mechanical Keyboard', 1, 129.00),
    (1001, 'SKU-004', 'Monitor Stand', 1, 45.00),
    (1001, 'SKU-005', 'Webcam HD', 1, 59.99);

INSERT INTO order_line_items (order_id, sku, product_name, quantity, unit_price) VALUES
    (1002, 'SKU-001', 'Wireless Headphones', 1, 79.99),
    (1002, 'SKU-002', 'USB-C Hub', 1, 24.50),
    (1002, 'SKU-003', 'Mechanical Keyboard', 1, 129.00),
    (1002, 'SKU-004', 'Monitor Stand', 1, 45.00),
    (1002, 'SKU-005', 'Webcam HD', 1, 59.99);

INSERT INTO order_line_items (order_id, sku, product_name, quantity, unit_price) VALUES
    (1003, 'SKU-001', 'Wireless Headphones', 2, 79.99),
    (1003, 'SKU-002', 'USB-C Hub', 1, 24.50),
    (1003, 'SKU-003', 'Mechanical Keyboard', 1, 129.00),
    (1003, 'SKU-004', 'Monitor Stand', 2, 45.00),
    (1003, 'SKU-005', 'Webcam HD', 1, 59.99);
