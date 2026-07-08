package com.hydropy.gateway.data

import android.content.Context
import androidx.room.*

@Entity(tableName = "pending_messages")
data class PendingMessage(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val smsId: Int,
    val phoneNumber: String,
    val message: String,
    val status: String = "PENDING", // PENDING, SENDING, SUCCESS, FAILED
    val retryCount: Int = 0,
    val createdAt: Long = System.currentTimeMillis(),
    val resultAt: Long? = null,
    val errorMessage: String? = null
)

@Entity(tableName = "config")
data class Config(
    @PrimaryKey val key: String,
    val value: String
)

@Entity(tableName = "local_logs")
data class LocalLog(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val level: String,
    val message: String,
    val createdAt: Long = System.currentTimeMillis()
)

@Dao
interface PendingMessageDao {
    @Query("SELECT * FROM pending_messages WHERE status = 'PENDING' ORDER BY createdAt ASC LIMIT 10")
    suspend fun getPending(): List<PendingMessage>

    @Insert
    suspend fun insert(msg: PendingMessage): Long

    @Update
    suspend fun update(msg: PendingMessage)

    @Query("UPDATE pending_messages SET status = :status, resultAt = :time, errorMessage = :error WHERE id = :id")
    suspend fun updateStatus(id: Long, status: String, time: Long, error: String?)

    @Query("SELECT COUNT(*) FROM pending_messages WHERE status = 'PENDING'")
    suspend fun pendingCount(): Int

    @Query("DELETE FROM pending_messages WHERE createdAt < :cutoff")
    suspend fun cleanOld(cutoff: Long)
}

@Dao
interface ConfigDao {
    @Query("SELECT value FROM config WHERE key = :key")
    suspend fun get(key: String): String?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun set(config: Config)

    @Query("DELETE FROM config WHERE key = :key")
    suspend fun delete(key: String)
}

@Dao
interface LocalLogDao {
    @Insert
    suspend fun insert(log: LocalLog)

    @Query("SELECT * FROM local_logs ORDER BY createdAt DESC LIMIT 200")
    suspend fun getRecent(): List<LocalLog>

    @Query("DELETE FROM local_logs WHERE createdAt < :cutoff")
    suspend fun cleanOld(cutoff: Long)
}

@Database(
    entities = [PendingMessage::class, Config::class, LocalLog::class],
    version = 1,
    exportSchema = false
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun pendingMessageDao(): PendingMessageDao
    abstract fun configDao(): ConfigDao
    abstract fun localLogDao(): LocalLogDao

    companion object {
        @Volatile private var INSTANCE: AppDatabase? = null

        fun getInstance(context: Context): AppDatabase {
            return INSTANCE ?: synchronized(this) {
                Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "hydropy_gateway.db"
                ).fallbackToDestructiveMigration()
                    .build()
                    .also { INSTANCE = it }
            }
        }
    }
}
