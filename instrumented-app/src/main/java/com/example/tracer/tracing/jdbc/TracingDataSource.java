package com.example.tracer.tracing.jdbc;

import com.example.tracer.tracing.SqlTraceListener;

import javax.sql.DataSource;
import java.io.PrintWriter;
import java.sql.Connection;
import java.sql.SQLException;
import java.sql.SQLFeatureNotSupportedException;
import java.util.logging.Logger;

/**
 * Wraps a delegate {@link DataSource} and returns {@link TracingConnection} instances
 * so every JDBC statement is recorded in the trace tree.
 */
public class TracingDataSource implements DataSource {

    private final DataSource delegate;
    private final SqlTraceListener sqlTraceListener;

    public TracingDataSource(DataSource delegate, SqlTraceListener sqlTraceListener) {
        this.delegate = delegate;
        this.sqlTraceListener = sqlTraceListener;
    }

    @Override
    public Connection getConnection() throws SQLException {
        return new TracingConnection(delegate.getConnection(), sqlTraceListener);
    }

    @Override
    public Connection getConnection(String username, String password) throws SQLException {
        return new TracingConnection(delegate.getConnection(username, password), sqlTraceListener);
    }

    @Override
    public PrintWriter getLogWriter() throws SQLException {
        return delegate.getLogWriter();
    }

    @Override
    public void setLogWriter(PrintWriter out) throws SQLException {
        delegate.setLogWriter(out);
    }

    @Override
    public void setLoginTimeout(int seconds) throws SQLException {
        delegate.setLoginTimeout(seconds);
    }

    @Override
    public int getLoginTimeout() throws SQLException {
        return delegate.getLoginTimeout();
    }

    @Override
    public Logger getParentLogger() throws SQLFeatureNotSupportedException {
        return delegate.getParentLogger();
    }

    @Override
    public <T> T unwrap(Class<T> iface) throws SQLException {
        if (iface.isInstance(this)) {
            return iface.cast(this);
        }
        return delegate.unwrap(iface);
    }

    @Override
    public boolean isWrapperFor(Class<?> iface) throws SQLException {
        return iface.isInstance(this) || delegate.isWrapperFor(iface);
    }
}
