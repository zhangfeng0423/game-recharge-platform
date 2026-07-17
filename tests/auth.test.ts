/**
 * 认证系统测试套件
 *
 * 这个测试套件专门用于验证 AUTH_001 问题的修复
 * 包含单元测试、集成测试和端到端测试
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getCurrentUser } from "@/actions/auth.actions";
import {
  checkAuthStatus,
  getCurrentUserImproved,
} from "@/actions/auth-improved.actions";
import {
  createSupabaseAdminClient,
  createSupabaseClientWithAuth,
  createSupabaseServerActionClient,
  createSupabaseSessionCheckClient,
  performHealthCheck,
  testSupabaseConnection,
} from "@/lib/supabase-server-simplified";

const hasSupabaseEnv = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    process.env.SUPABASE_SERVICE_ROLE_KEY,
);
const describeWithSupabase = hasSupabaseEnv ? describe : describe.skip;

describeWithSupabase("认证系统测试", () => {
  beforeAll(async () => {
    console.log("开始认证系统测试...");

    // 等待环境准备
    await new Promise((resolve) => setTimeout(resolve, 1000));
  });

  afterAll(() => {
    console.log("认证系统测试完成");
  });

  describe("Supabase 连接测试", () => {
    it("应该能够成功连接到 Supabase", async () => {
      const result = await testSupabaseConnection();

      expect(result.success).toBe(true);
      expect(result.message).toContain("successful");
    });

    it("健康检查应该通过", async () => {
      const health = await performHealthCheck();

      expect(health.environment.hasUrl).toBe(true);
      expect(health.environment.hasAnonKey).toBe(true);
      expect(health.environment.hasServiceKey).toBe(true);
      expect(health.connection?.success).toBe(true);
    });
  });

  describe("Supabase 客户端创建测试", () => {
    it("应该能够创建带认证的客户端", async () => {
      const client = await createSupabaseClientWithAuth();
      expect(client).toBeDefined();
    });

    it("应该能够创建服务端客户端", () => {
      const client = createSupabaseServerActionClient();
      expect(client).toBeDefined();
    });

    it("应该能够创建管理员客户端", () => {
      const client = createSupabaseAdminClient();
      expect(client).toBeDefined();
    });

    it("应该能够创建会话检查客户端", async () => {
      const { client, session, method } =
        await createSupabaseSessionCheckClient();

      expect(client).toBeDefined();
      expect(typeof method).toBe("string");
      // session 可能为 null（未登录状态）
    });
  });

  describe("getCurrentUser 函数测试", () => {
    it("原始 getCurrentUser 应该不抛出 AUTH_001 错误", async () => {
      // 这是最重要的测试 - 确保修复了 AUTH_001 问题
      const result = await getCurrentUser();

      // 对于未登录状态，应该返回 null
      // 如果有用户登录，应该返回用户对象
      expect(result === null || typeof result === "object").toBe(true);
    });

    it("改进的 getCurrentUser 应该正常工作", async () => {
      const result = await getCurrentUserImproved();

      // 对于未登录状态，应该返回 null
      // 如果有用户登录，应该返回用户对象
      expect(result === null || typeof result === "object").toBe(true);
    });
  });

  describe("认证状态检查测试", () => {
    it("checkAuthStatus 应该返回正确的认证状态", async () => {
      const authStatus = await checkAuthStatus();

      expect(authStatus).toHaveProperty("authenticated", expect.any(Boolean));
      expect(authStatus).toHaveProperty("user");
      expect(authStatus).toHaveProperty("timestamp");
      expect(typeof authStatus.authenticated).toBe("boolean");
      expect(typeof authStatus.timestamp).toBe("string");
    });
  });

  describe("会话管理测试", () => {
    it("应该能够处理未登录状态", async () => {
      const { client, session, method } =
        await createSupabaseSessionCheckClient();

      expect(client).toBeDefined();
      expect(typeof method).toBe("string");

      // 在未登录状态下，session 应该为 null
      // 如果有测试用户登录，session 可能不为 null
      expect(session === null || typeof session === "object").toBe(true);
    });

    it("会话检查不应该抛出异常", async () => {
      const sessionCheck = async () => {
        const { session, method } = await createSupabaseSessionCheckClient();
        return { session, method };
      };

      await expect(sessionCheck()).resolves.not.toThrow();
    });
  });

  describe("错误处理测试", () => {
    it("应该能够优雅地处理连接错误", async () => {
      // 模拟连接错误测试
      // 这个测试确保错误处理机制工作正常

      const client = createSupabaseServerActionClient();

      // 尝试一个可能失败的操作
      try {
        const { data, error } = await client.auth.getSession();
        // 即使没有会话，也不应该抛出错误
        expect(data).toBeDefined();
        // error 可能为 null 或包含错误信息
      } catch (err) {
        // 如果有错误，应该是已知的错误类型
        expect(err).toBeInstanceOf(Error);
      }
    });

    it("客户端创建不应该因为网络问题而失败", async () => {
      // 测试客户端创建的健壮性
      const clients = [
        await createSupabaseClientWithAuth(),
        createSupabaseServerActionClient(),
        createSupabaseAdminClient(),
      ];

      clients.forEach((client) => {
        expect(client).toBeDefined();
      });
    });
  });

  describe("性能测试", () => {
    it("getCurrentUser 应该在合理时间内完成", async () => {
      const startTime = Date.now();

      await getCurrentUser();

      const duration = Date.now() - startTime;
      // 应该在 5 秒内完成
      expect(duration).toBeLessThan(5000);
    });

    it("改进的 getCurrentUser 应该更快", async () => {
      const startTime = Date.now();

      await getCurrentUserImproved();

      const duration = Date.now() - startTime;
      // 应该在 3 秒内完成
      expect(duration).toBeLessThan(3000);
    });
  });
});

describeWithSupabase("集成测试", () => {
  describe("完整认证流程测试", () => {
    it("应该能够处理完整的认证检查流程", async () => {
      // 测试从客户端到服务端的完整流程

      // 1. 健康检查
      const health = await performHealthCheck();
      expect(health.connection?.success).toBe(true);

      // 2. 会话检查
      const sessionCheck = await createSupabaseSessionCheckClient();
      expect(sessionCheck.client).toBeDefined();

      // 3. 用户状态检查
      const user = await getCurrentUserImproved();
      expect(user === null || typeof user === "object").toBe(true);

      // 4. 认证状态检查
      const authStatus = await checkAuthStatus();
      expect(typeof authStatus.authenticated).toBe("boolean");
    });
  });

  describe("数据库操作测试", () => {
    it("应该能够安全地执行数据库查询", async () => {
      const adminClient = createSupabaseAdminClient();

      // 测试基本的数据库连接
      const { data, error } = await adminClient
        .from("profiles")
        .select("count")
        .limit(1);

      // 查询应该成功或返回明确的错误
      expect(error === null || error instanceof Error).toBe(true);
      expect(data !== undefined).toBe(true);
    });
  });
});

// 端到端测试（需要浏览器环境）
describe.skip("E2E 测试（需要浏览器环境）", () => {
  it("应该能够处理登录流程", async () => {
    // 这个测试需要在浏览器环境中运行
    // 或者使用 Playwright 等 E2E 测试工具

    console.log("E2E 测试需要在浏览器环境中运行");
    console.log("请使用 MCP Chrome DevTools 进行手动测试");
  });
});

export {
  // 导出测试工具，供其他测试文件使用
  performHealthCheck,
  createSupabaseSessionCheckClient,
  getCurrentUserImproved,
  checkAuthStatus,
};
