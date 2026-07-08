package com.hydropy.gateway.data;

import androidx.annotation.NonNull;
import androidx.room.DatabaseConfiguration;
import androidx.room.InvalidationTracker;
import androidx.room.RoomDatabase;
import androidx.room.RoomOpenHelper;
import androidx.room.migration.AutoMigrationSpec;
import androidx.room.migration.Migration;
import androidx.room.util.DBUtil;
import androidx.room.util.TableInfo;
import androidx.sqlite.db.SupportSQLiteDatabase;
import androidx.sqlite.db.SupportSQLiteOpenHelper;
import java.lang.Class;
import java.lang.Override;
import java.lang.String;
import java.lang.SuppressWarnings;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import javax.annotation.processing.Generated;

@Generated("androidx.room.RoomProcessor")
@SuppressWarnings({"unchecked", "deprecation"})
public final class AppDatabase_Impl extends AppDatabase {
  private volatile PendingMessageDao _pendingMessageDao;

  private volatile ConfigDao _configDao;

  private volatile LocalLogDao _localLogDao;

  @Override
  @NonNull
  protected SupportSQLiteOpenHelper createOpenHelper(@NonNull final DatabaseConfiguration config) {
    final SupportSQLiteOpenHelper.Callback _openCallback = new RoomOpenHelper(config, new RoomOpenHelper.Delegate(1) {
      @Override
      public void createAllTables(@NonNull final SupportSQLiteDatabase db) {
        db.execSQL("CREATE TABLE IF NOT EXISTS `pending_messages` (`id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, `smsId` INTEGER NOT NULL, `phoneNumber` TEXT NOT NULL, `message` TEXT NOT NULL, `status` TEXT NOT NULL, `retryCount` INTEGER NOT NULL, `createdAt` INTEGER NOT NULL, `resultAt` INTEGER, `errorMessage` TEXT)");
        db.execSQL("CREATE TABLE IF NOT EXISTS `config` (`key` TEXT NOT NULL, `value` TEXT NOT NULL, PRIMARY KEY(`key`))");
        db.execSQL("CREATE TABLE IF NOT EXISTS `local_logs` (`id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, `level` TEXT NOT NULL, `message` TEXT NOT NULL, `createdAt` INTEGER NOT NULL)");
        db.execSQL("CREATE TABLE IF NOT EXISTS room_master_table (id INTEGER PRIMARY KEY,identity_hash TEXT)");
        db.execSQL("INSERT OR REPLACE INTO room_master_table (id,identity_hash) VALUES(42, '7ea781a0f6d6412dbe0a2565b7286c89')");
      }

      @Override
      public void dropAllTables(@NonNull final SupportSQLiteDatabase db) {
        db.execSQL("DROP TABLE IF EXISTS `pending_messages`");
        db.execSQL("DROP TABLE IF EXISTS `config`");
        db.execSQL("DROP TABLE IF EXISTS `local_logs`");
        final List<? extends RoomDatabase.Callback> _callbacks = mCallbacks;
        if (_callbacks != null) {
          for (RoomDatabase.Callback _callback : _callbacks) {
            _callback.onDestructiveMigration(db);
          }
        }
      }

      @Override
      public void onCreate(@NonNull final SupportSQLiteDatabase db) {
        final List<? extends RoomDatabase.Callback> _callbacks = mCallbacks;
        if (_callbacks != null) {
          for (RoomDatabase.Callback _callback : _callbacks) {
            _callback.onCreate(db);
          }
        }
      }

      @Override
      public void onOpen(@NonNull final SupportSQLiteDatabase db) {
        mDatabase = db;
        internalInitInvalidationTracker(db);
        final List<? extends RoomDatabase.Callback> _callbacks = mCallbacks;
        if (_callbacks != null) {
          for (RoomDatabase.Callback _callback : _callbacks) {
            _callback.onOpen(db);
          }
        }
      }

      @Override
      public void onPreMigrate(@NonNull final SupportSQLiteDatabase db) {
        DBUtil.dropFtsSyncTriggers(db);
      }

      @Override
      public void onPostMigrate(@NonNull final SupportSQLiteDatabase db) {
      }

      @Override
      @NonNull
      public RoomOpenHelper.ValidationResult onValidateSchema(
          @NonNull final SupportSQLiteDatabase db) {
        final HashMap<String, TableInfo.Column> _columnsPendingMessages = new HashMap<String, TableInfo.Column>(9);
        _columnsPendingMessages.put("id", new TableInfo.Column("id", "INTEGER", true, 1, null, TableInfo.CREATED_FROM_ENTITY));
        _columnsPendingMessages.put("smsId", new TableInfo.Column("smsId", "INTEGER", true, 0, null, TableInfo.CREATED_FROM_ENTITY));
        _columnsPendingMessages.put("phoneNumber", new TableInfo.Column("phoneNumber", "TEXT", true, 0, null, TableInfo.CREATED_FROM_ENTITY));
        _columnsPendingMessages.put("message", new TableInfo.Column("message", "TEXT", true, 0, null, TableInfo.CREATED_FROM_ENTITY));
        _columnsPendingMessages.put("status", new TableInfo.Column("status", "TEXT", true, 0, null, TableInfo.CREATED_FROM_ENTITY));
        _columnsPendingMessages.put("retryCount", new TableInfo.Column("retryCount", "INTEGER", true, 0, null, TableInfo.CREATED_FROM_ENTITY));
        _columnsPendingMessages.put("createdAt", new TableInfo.Column("createdAt", "INTEGER", true, 0, null, TableInfo.CREATED_FROM_ENTITY));
        _columnsPendingMessages.put("resultAt", new TableInfo.Column("resultAt", "INTEGER", false, 0, null, TableInfo.CREATED_FROM_ENTITY));
        _columnsPendingMessages.put("errorMessage", new TableInfo.Column("errorMessage", "TEXT", false, 0, null, TableInfo.CREATED_FROM_ENTITY));
        final HashSet<TableInfo.ForeignKey> _foreignKeysPendingMessages = new HashSet<TableInfo.ForeignKey>(0);
        final HashSet<TableInfo.Index> _indicesPendingMessages = new HashSet<TableInfo.Index>(0);
        final TableInfo _infoPendingMessages = new TableInfo("pending_messages", _columnsPendingMessages, _foreignKeysPendingMessages, _indicesPendingMessages);
        final TableInfo _existingPendingMessages = TableInfo.read(db, "pending_messages");
        if (!_infoPendingMessages.equals(_existingPendingMessages)) {
          return new RoomOpenHelper.ValidationResult(false, "pending_messages(com.hydropy.gateway.data.PendingMessage).\n"
                  + " Expected:\n" + _infoPendingMessages + "\n"
                  + " Found:\n" + _existingPendingMessages);
        }
        final HashMap<String, TableInfo.Column> _columnsConfig = new HashMap<String, TableInfo.Column>(2);
        _columnsConfig.put("key", new TableInfo.Column("key", "TEXT", true, 1, null, TableInfo.CREATED_FROM_ENTITY));
        _columnsConfig.put("value", new TableInfo.Column("value", "TEXT", true, 0, null, TableInfo.CREATED_FROM_ENTITY));
        final HashSet<TableInfo.ForeignKey> _foreignKeysConfig = new HashSet<TableInfo.ForeignKey>(0);
        final HashSet<TableInfo.Index> _indicesConfig = new HashSet<TableInfo.Index>(0);
        final TableInfo _infoConfig = new TableInfo("config", _columnsConfig, _foreignKeysConfig, _indicesConfig);
        final TableInfo _existingConfig = TableInfo.read(db, "config");
        if (!_infoConfig.equals(_existingConfig)) {
          return new RoomOpenHelper.ValidationResult(false, "config(com.hydropy.gateway.data.Config).\n"
                  + " Expected:\n" + _infoConfig + "\n"
                  + " Found:\n" + _existingConfig);
        }
        final HashMap<String, TableInfo.Column> _columnsLocalLogs = new HashMap<String, TableInfo.Column>(4);
        _columnsLocalLogs.put("id", new TableInfo.Column("id", "INTEGER", true, 1, null, TableInfo.CREATED_FROM_ENTITY));
        _columnsLocalLogs.put("level", new TableInfo.Column("level", "TEXT", true, 0, null, TableInfo.CREATED_FROM_ENTITY));
        _columnsLocalLogs.put("message", new TableInfo.Column("message", "TEXT", true, 0, null, TableInfo.CREATED_FROM_ENTITY));
        _columnsLocalLogs.put("createdAt", new TableInfo.Column("createdAt", "INTEGER", true, 0, null, TableInfo.CREATED_FROM_ENTITY));
        final HashSet<TableInfo.ForeignKey> _foreignKeysLocalLogs = new HashSet<TableInfo.ForeignKey>(0);
        final HashSet<TableInfo.Index> _indicesLocalLogs = new HashSet<TableInfo.Index>(0);
        final TableInfo _infoLocalLogs = new TableInfo("local_logs", _columnsLocalLogs, _foreignKeysLocalLogs, _indicesLocalLogs);
        final TableInfo _existingLocalLogs = TableInfo.read(db, "local_logs");
        if (!_infoLocalLogs.equals(_existingLocalLogs)) {
          return new RoomOpenHelper.ValidationResult(false, "local_logs(com.hydropy.gateway.data.LocalLog).\n"
                  + " Expected:\n" + _infoLocalLogs + "\n"
                  + " Found:\n" + _existingLocalLogs);
        }
        return new RoomOpenHelper.ValidationResult(true, null);
      }
    }, "7ea781a0f6d6412dbe0a2565b7286c89", "a7b858de3509dcd0c76386e07c77c9ab");
    final SupportSQLiteOpenHelper.Configuration _sqliteConfig = SupportSQLiteOpenHelper.Configuration.builder(config.context).name(config.name).callback(_openCallback).build();
    final SupportSQLiteOpenHelper _helper = config.sqliteOpenHelperFactory.create(_sqliteConfig);
    return _helper;
  }

  @Override
  @NonNull
  protected InvalidationTracker createInvalidationTracker() {
    final HashMap<String, String> _shadowTablesMap = new HashMap<String, String>(0);
    final HashMap<String, Set<String>> _viewTables = new HashMap<String, Set<String>>(0);
    return new InvalidationTracker(this, _shadowTablesMap, _viewTables, "pending_messages","config","local_logs");
  }

  @Override
  public void clearAllTables() {
    super.assertNotMainThread();
    final SupportSQLiteDatabase _db = super.getOpenHelper().getWritableDatabase();
    try {
      super.beginTransaction();
      _db.execSQL("DELETE FROM `pending_messages`");
      _db.execSQL("DELETE FROM `config`");
      _db.execSQL("DELETE FROM `local_logs`");
      super.setTransactionSuccessful();
    } finally {
      super.endTransaction();
      _db.query("PRAGMA wal_checkpoint(FULL)").close();
      if (!_db.inTransaction()) {
        _db.execSQL("VACUUM");
      }
    }
  }

  @Override
  @NonNull
  protected Map<Class<?>, List<Class<?>>> getRequiredTypeConverters() {
    final HashMap<Class<?>, List<Class<?>>> _typeConvertersMap = new HashMap<Class<?>, List<Class<?>>>();
    _typeConvertersMap.put(PendingMessageDao.class, PendingMessageDao_Impl.getRequiredConverters());
    _typeConvertersMap.put(ConfigDao.class, ConfigDao_Impl.getRequiredConverters());
    _typeConvertersMap.put(LocalLogDao.class, LocalLogDao_Impl.getRequiredConverters());
    return _typeConvertersMap;
  }

  @Override
  @NonNull
  public Set<Class<? extends AutoMigrationSpec>> getRequiredAutoMigrationSpecs() {
    final HashSet<Class<? extends AutoMigrationSpec>> _autoMigrationSpecsSet = new HashSet<Class<? extends AutoMigrationSpec>>();
    return _autoMigrationSpecsSet;
  }

  @Override
  @NonNull
  public List<Migration> getAutoMigrations(
      @NonNull final Map<Class<? extends AutoMigrationSpec>, AutoMigrationSpec> autoMigrationSpecs) {
    final List<Migration> _autoMigrations = new ArrayList<Migration>();
    return _autoMigrations;
  }

  @Override
  public PendingMessageDao pendingMessageDao() {
    if (_pendingMessageDao != null) {
      return _pendingMessageDao;
    } else {
      synchronized(this) {
        if(_pendingMessageDao == null) {
          _pendingMessageDao = new PendingMessageDao_Impl(this);
        }
        return _pendingMessageDao;
      }
    }
  }

  @Override
  public ConfigDao configDao() {
    if (_configDao != null) {
      return _configDao;
    } else {
      synchronized(this) {
        if(_configDao == null) {
          _configDao = new ConfigDao_Impl(this);
        }
        return _configDao;
      }
    }
  }

  @Override
  public LocalLogDao localLogDao() {
    if (_localLogDao != null) {
      return _localLogDao;
    } else {
      synchronized(this) {
        if(_localLogDao == null) {
          _localLogDao = new LocalLogDao_Impl(this);
        }
        return _localLogDao;
      }
    }
  }
}
